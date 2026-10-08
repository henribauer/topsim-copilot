import { useCallback, useEffect, useRef, useState } from "react";
import type { BridgeResult } from "./desktop/bridge";
import type { AppInfo } from "./server/api";
import type { ClaudeStatus } from "./setup/claudeStatus";
import { INSTALL_COMMAND, INSTALL_DOCS_URL, LOGIN_COMMAND, PLANS_URL } from "./setup/commands";
import { setupView, type SetupStep } from "./setup/view";

export type AppState = { desktop: false } | ({ desktop: true } & AppInfo);

const post = (body: unknown) => fetch("/api/app/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/**
 * Setup state for the whole app. Only the desktop app has a setup (the dev launcher answers desktop:false and
 * nothing changes there). On first launch the dialog opens by itself — but only if Claude is not ready, and only
 * until the user closes it once; after that it opens from the sidebar's Setup button.
 */
export function useSetup() {
  const [app, setApp] = useState<AppState | null>(null);
  const [status, setStatus] = useState<ClaudeStatus | null>(null);
  const [open, setOpen] = useState(false);
  const autoOpened = useRef(false);

  const refresh = useCallback(async () => {
    try {
      setApp((await (await fetch("/api/app")).json()) as AppState);
    } catch {
      setApp({ desktop: false });
    }
  }, []);
  const recheck = useCallback(async () => {
    setStatus(null);
    try {
      setStatus((await (await fetch("/api/claude/status")).json()) as ClaudeStatus);
    } catch {
      setStatus({ state: "check-failed", installed: null, signedIn: null, version: null, message: "The check could not be run." });
    }
  }, []);

  useEffect(() => void refresh(), [refresh]);
  useEffect(() => {
    if (app?.desktop) void recheck();
  }, [app?.desktop, recheck]);
  useEffect(() => {
    if (app?.desktop && !app.setupDismissed && status && status.state !== "ready" && !autoOpened.current) {
      autoOpened.current = true;
      setOpen(true);
    }
  }, [app, status]);

  return {
    app,
    status,
    open,
    show: () => {
      setOpen(true);
      void recheck();
    },
    close: async () => {
      setOpen(false);
      if (app?.desktop && !app.setupDismissed) {
        await post({ dismissed: true });
        void refresh();
      }
    },
    recheck,
    refresh,
  };
}
export type SetupState = ReturnType<typeof useSetup>;

function Command({ which, text }: { which: "install" | "login"; text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    const ok = window.topsim ? (await window.topsim.copyCommand(which)).ok : await navigator.clipboard.writeText(text).then(() => true, () => false);
    setCopied(ok);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="setup-cmd">
      <code>{text}</code>
      <button className="secondary" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function Steps({ steps }: { steps: SetupStep[] }) {
  return (
    <ol className="setup-steps">
      {steps.includes("install") && (
        <li>
          <p>
            <strong>Install Claude.</strong> Open Terminal, paste this line and press Return. It downloads Anthropic's installer and runs it —
            TOPSIM Copilot never runs it for you.
          </p>
          <Command which="install" text={INSTALL_COMMAND} />
          <p className="muted">
            <a href={INSTALL_DOCS_URL} target="_blank" rel="noreferrer">
              Anthropic's install guide
            </a>
          </p>
        </li>
      )}
      {steps.includes("login") && (
        <li>
          <p>
            <strong>Sign in.</strong> In Terminal run the line below and finish in the browser window it opens. You type your password there, not
            in TOPSIM Copilot — it never asks for or sees passwords, tokens or codes.
          </p>
          <Command which="login" text={LOGIN_COMMAND} />
        </li>
      )}
    </ol>
  );
}

function SourceRow({
  title,
  state,
  help,
  choose,
  clear,
  present,
}: {
  title: string;
  state: string;
  help: string;
  choose: () => Promise<BridgeResult>;
  clear: () => Promise<BridgeResult>;
  present: boolean;
}) {
  return (
    <div className="setup-source">
      <div className="setup-row">
        <div>
          <strong>{title}</strong>
          <div className="muted setup-state">{state}</div>
        </div>
        <div className="setup-buttons">
          <button className="secondary" onClick={() => void choose()}>
            {present ? "Replace…" : "Choose…"}
          </button>
          {present && (
            <button className="secondary" onClick={() => void clear()}>
              Remove
            </button>
          )}
        </div>
      </div>
      <p className="muted">{help}</p>
    </div>
  );
}

export function SetupDialog({ setup }: { setup: SetupState }) {
  const [message, setMessage] = useState<string | null>(null);
  const { app, status, open } = setup;
  const dialog = useRef<HTMLDivElement>(null);
  // Focus the dialog itself without scrolling: focusing the button at its end would scroll the heading out of sight.
  useEffect(() => {
    if (open && app?.desktop) dialog.current?.focus({ preventScroll: true });
  }, [open, app?.desktop]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && void setup.close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  if (!open || !app?.desktop) return null;
  const view = setupView(status);
  const bridge = window.topsim;
  async function act(action: (() => Promise<BridgeResult>) | undefined) {
    if (!action) return;
    const r = await action();
    setMessage(r.ok || r.canceled ? null : (r.error ?? "That did not work."));
    await setup.refresh();
  }

  return (
    <div className="setup-backdrop">
      <div className="setup-dialog" role="dialog" aria-modal="true" aria-labelledby="setup-title" tabIndex={-1} ref={dialog}>
        <h2 id="setup-title">{app.setupDismissed ? "Setup" : "Welcome to TOPSIM Copilot"}</h2>
        <p className="muted">Everything here is optional. Importing reports, the Dashboard, Analysis, Planner, What-if, Quiz and Glossary work without it.</p>

        <h3>Your data stays on this Mac</h3>
        <p>
          Imported reports are saved in <code className="setup-path">{app.dataDir}</code>. Nothing is uploaded when you import, view or analyse them.
        </p>

        <h3>AI copilot (needs Claude)</h3>
        <p>
          <span className={`setup-pill ${view.tone}`} role="status">
            {view.headline}
          </span>
          {status && <span className="muted"> {status.version ? `Version ${status.version}. ` : ""}{status.message}</span>}
        </p>
        <p className="privacy">
          When you ask the copilot a question, your saved reports — and the handbook and lecture notes you add below — are sent to Anthropic through
          your own Claude account. Nothing is sent unless you ask.
        </p>
        <p className="muted">
          It needs an internet connection and a Claude account on a plan that includes Claude Code (see{" "}
          <a href={PLANS_URL} target="_blank" rel="noreferrer">
            Anthropic's plans
          </a>
          ). TOPSIM Copilot does not include or pay for one.
        </p>
        {view.steps.length > 0 && <Steps steps={view.steps} />}
        <div className="setup-buttons">
          <button className="secondary" onClick={() => void setup.recheck()}>
            Recheck
          </button>
        </div>

        <h3>Your own course sources (optional)</h3>
        <p className="muted">
          The planner and glossary use rules and definitions built into the app, so they work without these. The full TOPSIM manual and lecture
          material are not included — add your own copies if you want the copilot to quote them.
        </p>
        {!bridge && <p className="muted">Choosing files is only available in the desktop app.</p>}
        {message && (
          <div className="error" role="alert">
            {message}
          </div>
        )}
        {bridge && (
          <>
            <SourceRow
              title="Handbook"
              present={app.handbook.present}
              state={app.handbook.present ? `Added · ${app.handbook.chars.toLocaleString("en-US")} characters` : "None added"}
              help="A plain text copy (.txt or .md, up to 600 KB) of your own TOPSIM participant manual. PDFs are not read in this version: copy the text into a .txt file first. Without it, the copilot answers from your reports and lecture notes only."
              choose={() => (act(bridge.chooseHandbook), Promise.resolve({ ok: true }))}
              clear={() => (act(bridge.clearHandbook), Promise.resolve({ ok: true }))}
            />
            <SourceRow
              title="Lecture notes folder"
              present={app.lecture.dir !== null}
              state={app.lecture.dir ? `${app.lecture.notes} note${app.lecture.notes === 1 ? "" : "s"} found` : "None chosen"}
              help="A folder with your own notes as .md or .txt files (a Class Notes.md plus a Class Material folder works too). It is only read, never changed."
              choose={() => (act(bridge.chooseLectureFolder), Promise.resolve({ ok: true }))}
              clear={() => (act(bridge.clearLectureFolder), Promise.resolve({ ok: true }))}
            />
          </>
        )}

        <div className="setup-actions">
          <button className="primary" onClick={() => void setup.close()}>
            {view.primary}
          </button>
        </div>
      </div>
    </div>
  );
}
