import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, protocol, session, shell, type IpcMainInvokeEvent } from "electron";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { readLectureNotes } from "../copilot/copilotApi";
import { handleApi, readBody, type ApiContext, type AppServices } from "../server/api";
import { checkClaude } from "../setup/claudeStatus";
import { INSTALL_COMMAND, LOGIN_COMMAND } from "../setup/commands";
import { readSettings, writeSettings } from "../setup/settings";
import { handbookInfo, importHandbook, removeHandbook } from "../setup/sources";
import type { BridgeResult } from "./bridge";
import { APP_HOST, APP_URL, CSP, externalLinkAllowed, isAppUrl, mimeFor, resolveStaticPath } from "./security";

// The page and the API are served from app://topsim: no network port is opened, so no other program or website
// can reach the API, and there is nothing to rebind. Must be declared before the app is ready.
protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

if (!app.requestSingleInstanceLock()) app.quit();

let win: BrowserWindow | null = null;

function paths() {
  const userData = app.getPath("userData");
  return { reports: join(userData, "reports"), settings: join(userData, "settings.json"), sources: join(userData, "sources") };
}

function apiContext(): ApiContext {
  const p = paths();
  const services: AppServices = {
    info: () => {
      const s = readSettings(p.settings);
      const hb = handbookInfo(p.sources);
      return {
        dataDir: p.reports,
        setupDismissed: s.setupDismissed,
        handbook: { present: hb.present, chars: hb.chars },
        lecture: { dir: s.lectureDir, notes: s.lectureDir ? readLectureNotes(s.lectureDir).length : 0 },
      };
    },
    setSetupDismissed: (dismissed) => void writeSettings(p.settings, { setupDismissed: dismissed }),
    claudeStatus: () => checkClaude(),
  };
  return {
    vaultDir: p.reports,
    app: services,
    copilot: () => ({ vaultDir: p.reports, courseDir: readSettings(p.settings).lectureDir ?? undefined, handbookPath: handbookInfo(p.sources).path ?? undefined }),
  };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

function serveApp(distDir: string) {
  const ctx = apiContext();
  protocol.handle("app", async (request) => {
    const url = new URL(request.url);
    if (url.hostname !== APP_HOST) return new Response("Not found", { status: 404 });
    if (url.pathname.startsWith("/api/")) {
      const method = request.method;
      const body = method === "GET" || method === "HEAD" || !request.body ? "" : await readBody(request.body as unknown as AsyncIterable<Uint8Array>);
      if (body === null) return json(413, { ok: false, error: "Request body too large" });
      const out = await handleApi(ctx, { method, path: url.pathname, body, origin: request.headers.get("origin") ?? undefined });
      return json(out.status, out.body);
    }
    const file = resolveStaticPath(distDir, url.pathname);
    if (!file || !existsSync(file) || !statSync(file).isFile()) return new Response("Not found", { status: 404 });
    return new Response(new Uint8Array(readFileSync(file)), {
      headers: { "Content-Type": mimeFor(file), "Content-Security-Policy": CSP, "X-Content-Type-Options": "nosniff" },
    });
  });
}

const fromApp = (e: IpcMainInvokeEvent) => isAppUrl(e.senderFrame?.url ?? "");
const refused: BridgeResult = { ok: false, error: "Not allowed" };
/** Our own validation errors are written for the user; anything from the file system is not. */
const reason = (e: unknown) => (e instanceof Error && !(e as NodeJS.ErrnoException).code ? e.message : "Could not read that.");

function registerIpc() {
  const p = paths();
  ipcMain.handle("handbook:choose", async (e): Promise<BridgeResult> => {
    if (!fromApp(e)) return refused;
    const r = await dialog.showOpenDialog(win!, {
      title: "Choose your handbook as a text file",
      properties: ["openFile"],
      filters: [{ name: "Text or Markdown", extensions: ["txt", "md", "text"] }],
    });
    if (r.canceled || !r.filePaths[0]) return { ok: false, canceled: true };
    try {
      importHandbook(p.sources, r.filePaths[0]);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: reason(err) };
    }
  });
  ipcMain.handle("handbook:clear", (e): BridgeResult => (fromApp(e) ? (removeHandbook(p.sources), { ok: true }) : refused));
  ipcMain.handle("lecture:choose", async (e): Promise<BridgeResult> => {
    if (!fromApp(e)) return refused;
    const r = await dialog.showOpenDialog(win!, { title: "Choose your lecture notes folder", properties: ["openDirectory"] });
    if (r.canceled || !r.filePaths[0]) return { ok: false, canceled: true };
    if (readLectureNotes(r.filePaths[0]).length === 0) return { ok: false, error: "No .md or .txt notes found in that folder." };
    writeSettings(p.settings, { lectureDir: r.filePaths[0] });
    return { ok: true };
  });
  ipcMain.handle("lecture:clear", (e): BridgeResult => (fromApp(e) ? (writeSettings(p.settings, { lectureDir: null }), { ok: true }) : refused));
  ipcMain.handle("command:copy", (e, which: unknown): BridgeResult => {
    if (!fromApp(e) || (which !== "install" && which !== "login")) return refused;
    clipboard.writeText(which === "install" ? INSTALL_COMMAND : LOGIN_COMMAND);
    return { ok: true };
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: "TOPSIM Copilot",
    backgroundColor: "#f5f6f8",
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
      devTools: !app.isPackaged,
    },
  });
  const wc = win.webContents;
  // The window may only ever show the app itself. A link to anything else opens in the browser if it is on the
  // short allowlist (the install guide, pricing) and is dropped otherwise; no second window is ever created.
  const navigate = (e: { preventDefault(): void }, url: string) => {
    if (isAppUrl(url)) return;
    e.preventDefault();
    if (externalLinkAllowed(url)) void shell.openExternal(url);
  };
  wc.on("will-navigate", navigate);
  wc.on("will-redirect", navigate);
  wc.setWindowOpenHandler(({ url }) => {
    if (externalLinkAllowed(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.once("ready-to-show", () => win?.show());
  win.on("closed", () => (win = null));
  void win.loadURL(APP_URL);
}

app.on("web-contents-created", (_e, contents) => contents.on("will-attach-webview", (ev) => ev.preventDefault()));
app.on("second-instance", () => {
  if (win?.isMinimized()) win.restore();
  win?.focus();
});
app.on("window-all-closed", () => app.quit());

void app.whenReady().then(() => {
  // No camera, microphone, notifications, … for a page that needs none.
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, done) => done(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: "appMenu" }, { role: "editMenu" }, { role: "windowMenu" }]));
  serveApp(join(__dirname, "dist"));
  registerIpc();
  createWindow();
});
