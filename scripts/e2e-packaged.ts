// Drives the PACKAGED app (release/mac-<arch>/TOPSIM Copilot.app) over CDP with playwright-core.
// Isolated: scratch HOME + --user-data-dir under ~/.hermes/cache/scratch, PATH without node/npm, stand-in `claude`
// scripts (the real CLI is never touched), report text read from the private fixture at run time only.
// Run: ARCH=arm64 npx vite-node scripts/e2e-packaged.ts
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { chmodSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright-core";

const ARCH = process.env.ARCH ?? "arm64";
const APP = join(process.env.TOPSIM_LOCAL ?? join(homedir(), "claude-local/topsim-copilot"), "release", ARCH === "arm64" ? "mac-arm64" : "mac", "TOPSIM Copilot.app");
const EXE = join(APP, "Contents/MacOS/TOPSIM Copilot");
const BASE = join(homedir(), ".hermes/cache/scratch/topsim-mac-e2e");
const RUN = join(BASE, `run-${new Date().toISOString().replace(/[:.]/g, "-")}`);
const SHOTS = join(RUN, "screenshots");
mkdirSync(SHOTS, { recursive: true });
const PATH_ENV = "/usr/bin:/bin:/usr/sbin:/sbin";
const INSTALL = "curl -fsSL https://claude.ai/install.sh | bash";
const SECRETS = ["private@example.invalid", "sk-fake-token"];
const sample = readFileSync(join(process.cwd(), "docs/p0_reports_sample.txt"), "utf8"); // private fixture, test time only
const reportText = (marker: string) => sample.split(marker)[1].split("=== ")[0];
const CM = reportText("=== Report11_Contribution Margin.pdf");
const ALL_P0 = sample.split("\n").filter((l) => l.startsWith("=== Report")).map(reportText);

const checks: { name: string; ok: boolean; detail: string }[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const shots: string[] = [];
const shot = async (p: Page, name: string) => {
  const f = join(SHOTS, `${name}.png`);
  await p.screenshot({ path: f });
  shots.push(f);
};
const nav = (p: Page, name: string) => p.locator("nav.sidebar").getByRole("button", { name, exact: true }).click();
const leaks: string[] = [];

function fakeClaude(home: string, mode: "ready" | "logged-out" | "fail", logBase: string) {
  const dir = join(home, ".local/bin");
  mkdirSync(dir, { recursive: true });
  const version = mode === "fail" ? "exit 3" : 'echo "2.1.289 (Claude Code)"';
  const auth = mode === "ready" ? `echo '{"loggedIn":true,"authMethod":"claude.ai","email":"${SECRETS[0]}","token":"${SECRETS[1]}"}'` : "echo '{\"loggedIn\":false}'; exit 1";
  writeFileSync(
    join(dir, "claude"),
    `#!/bin/sh\necho "$1 $2" >> "${logBase}.calls"\ncase "$1" in\n  --version) ${version} ;;\n  auth) ${auth} ;;\n  -p) cat > "${logBase}.stdin"; printf '%s\\n' "$@" > "${logBase}.args"; echo "FAKE-ANSWER from the stand-in claude" ;;\nesac\n`,
  );
  chmodSync(join(dir, "claude"), 0o755);
}

// Whatever happens (a failed check throws), no test app is left running: every child is killed on exit.
const children: ChildProcess[] = [];
process.on("exit", () => children.forEach((c) => c.exitCode === null && c.kill("SIGKILL")));
let nextPort = 9500 + Math.floor(Math.random() * 300);
async function launch(name: string, o: { home: string; userData: string }) {
  const port = nextPort++;
  const dir = join(RUN, name);
  mkdirSync(join(dir, "tmp"), { recursive: true });
  mkdirSync(o.home, { recursive: true });
  const out = openSync(join(dir, "stdout.log"), "w");
  const err = openSync(join(dir, "stderr.log"), "w");
  const env = { PATH: PATH_ENV, HOME: o.home, USER: process.env.USER ?? "", LOGNAME: process.env.USER ?? "", LANG: "en_US.UTF-8", TMPDIR: join(dir, "tmp"), FAKE_CLAUDE_LOG: join(dir, "claude") };
  const proc = spawn(EXE, [`--remote-debugging-port=${port}`, `--user-data-dir=${o.userData}`], { env, stdio: ["ignore", out, err] });
  children.push(proc);
  closeSync(out);
  closeSync(err);
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break;
    } catch {
      /* not up yet */
    }
    if (i > 100 || proc.exitCode !== null) throw new Error(`${name}: app did not start (exit ${proc.exitCode})`);
    await sleep(300);
  }
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const ctx = browser.contexts()[0];
  let page: Page | undefined;
  for (let i = 0; !page && i < 60; i++) {
    page = ctx.pages().find((p) => p.url().startsWith("app://"));
    if (!page) await sleep(200);
  }
  if (!page) throw new Error(`${name}: no app window`);
  const errors: string[] = [];
  const aborted: string[] = [];
  const api: { url: string; body: string }[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(`console.error: ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("requestfailed", (r) => (r.failure()?.errorText.includes("ERR_ABORTED") ? aborted : errors).push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
  page.on("response", async (r) => {
    if (r.url().includes("/api/")) api.push({ url: r.url(), body: await r.text().catch(() => "") });
  });
  await page.reload();
  await page.waitForSelector("nav.sidebar");
  return {
    page,
    ctx,
    port,
    pid: proc.pid!,
    errors,
    aborted,
    api,
    dir,
    async stop() {
      await browser.close().catch(() => undefined);
      if (proc.exitCode !== null) return;
      proc.kill("SIGTERM");
      await new Promise((res) => {
        proc.once("exit", res);
        setTimeout(() => (proc.kill("SIGKILL"), res(null)), 6000).unref();
      });
    },
  };
}
const noErrors = (name: string, s: { errors: string[]; aborted: string[] }) => check(`${name}: zero console/page/request errors`, s.errors.length === 0, s.errors.slice(0, 3).join(" | ") || `${s.aborted.length} request(s) aborted by the reload (ignored)`);
const dialogOf = (p: Page) => p.getByRole("dialog");
const setupText = async (p: Page) => {
  const t = await dialogOf(p).innerText();
  leaks.push(t);
  return t;
};

// ---- environment facts
check("PATH given to the app has no node/npm", execFileSync("/usr/bin/env", ["-i", `PATH=${PATH_ENV}`, "/bin/sh", "-c", "command -v node npm npx || echo none"], { encoding: "utf8" }).trim() === "none", PATH_ENV);
const ud1 = join(RUN, "userdata-main");
const home1 = join(RUN, "home-missing");

// ---- S1: first launch, Claude missing
{
  const s = await launch("s1-first-launch-missing", { home: home1, userData: ud1 });
  const p = s.page;
  await dialogOf(p).waitFor({ timeout: 20000 });
  const t = await setupText(p);
  check("S1 setup opens by itself on first launch when Claude is missing", /Welcome to TOPSIM Copilot/i.test(t) && /Claude is not installed/.test(t), JSON.stringify(t.slice(0, 90)));
  check("S1 shows the official install line + docs link + sign-in command", t.includes(INSTALL) && t.includes("claude auth login") && (await dialogOf(p).locator('a[href="https://code.claude.com/docs/en/setup"]').count()) === 1);
  check("S1 states account/billing requirement and the Anthropic disclosure", /Claude account on a plan that includes Claude Code/.test(t) && /does not include or pay for one/.test(t) && /sent to Anthropic/.test(t) && /Nothing is sent unless you ask/.test(t));
  check("S1 has no password/token/API-key fields", (await dialogOf(p).locator("input, textarea").count()) === 0);
  check("S1 does not claim a handbook or lecture folder that is not there", /Handbook\s*None added/.test(t) && /Lecture notes folder\s*None chosen/.test(t) && /not included/.test(t));
  check("S1 explains where reports are stored (own userData folder)", t.includes(join(ud1, "reports")), t.match(/saved in\s+(\S+)/)?.[1] ?? "");
  await shot(p, "01-setup-missing");

  const before = execFileSync("pbpaste", { encoding: "buffer" });
  await dialogOf(p).getByRole("button", { name: "Copy" }).first().click();
  await sleep(300);
  check("S1 Copy puts exactly the official install line on the clipboard", execFileSync("pbpaste", { encoding: "utf8" }) === INSTALL);
  execFileSync("pbcopy", { input: before }); // restore the user's clipboard text

  await dialogOf(p).getByRole("button", { name: "Skip for now" }).click();
  await dialogOf(p).waitFor({ state: "hidden" });
  await sleep(500);
  check("S1 'Skip for now' closes setup and remembers it in settings.json", JSON.parse(readFileSync(join(ud1, "settings.json"), "utf8")).setupDismissed === true);

  // non-AI use: import, save, read back
  await nav(p, "Import");
  await p.getByRole("button", { name: "Paste text" }).click();
  await p.getByLabel("Report text").fill(CM);
  await p.getByRole("button", { name: "Save to vault" }).click();
  await p.getByText(/Saved TNB10/).first().waitFor({ timeout: 10000 });
  await shot(p, "02-import-saved");
  const file = join(ud1, "reports/data/period-0.json");
  check("S1 report saved on disk in the app's own userData folder", existsSync(file) && JSON.parse(readFileSync(file, "utf8")).reports.TNB10.parsed.period === 0, file);
  check("S1 report read back through the app's API", await p.evaluate(async () => (await (await fetch("/api/periods")).json()).periods[0]?.reports?.TNB10?.kind === "cm"));
  // the rest of period 0 (all 16 reports of the private sample) through the API, so Dashboard/Analysis have data
  const saved = await p.evaluate(async (texts) => {
    let ok = 0;
    for (const text of texts) ok += (await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) })).ok ? 1 : 0;
    return ok;
  }, ALL_P0);
  check("S1 all 16 reports of the private P0 sample save through the app", saved === ALL_P0.length, `${saved}/${ALL_P0.length}`);
  await nav(p, "Dashboard");
  await p.locator("main.page").getByText(/Net income/i).first().waitFor({ timeout: 10000 });
  await shot(p, "03-dashboard-with-report");
  await nav(p, "Analysis");
  await p.locator("main.page").getByText(/break-even|Contribution/i).first().waitFor({ timeout: 10000 });
  await shot(p, "04-analysis");
  for (const [page, title] of [["Planner", "Planner"], ["What-if", "What-if"], ["Quiz", "Quiz"], ["Glossary", "Glossary"], ["Import", "Import reports"]] as const) {
    await nav(p, page);
    await sleep(250);
    check(`S1 page ${page} opens without Claude`, (await p.locator("h1").innerText()) === title);
  }
  await nav(p, "Planner");
  await sleep(400);
  await shot(p, "05-planner");

  // reopen setup from the sidebar
  await p.locator("nav.sidebar").getByRole("button", { name: "Setup", exact: true }).click();
  await dialogOf(p).waitFor();
  check("S1 setup can be reopened later (title is 'Setup' after the first dismissal)", /^Setup/i.test((await setupText(p)).trim()));
  await shot(p, "06-setup-reopened");
  await dialogOf(p).getByRole("button", { name: "Skip for now" }).click();

  noErrors("S1", s); // everything so far, including all seven pages
  // copilot without Claude: a clear message, the rest keeps working
  await p.locator(".dock-toggle").click();
  await p.getByLabel("Ask the copilot").fill("Explain my CM");
  await p.getByRole("button", { name: "Ask", exact: true }).click();
  await p.locator(".error[role=alert]").waitFor({ timeout: 15000 });
  check("S1 asking the copilot without Claude fails with a plain message", /not found/.test(await p.locator(".error[role=alert]").innerText()));
  check("S1 the only console error since then is the browser noting the app's own 502 answer to that question", s.errors.length === 1 && /502/.test(s.errors[0]), s.errors.join(" | "));

  // desktop boundary probes
  const popup = await p.evaluate(() => window.open("https://evil.example/") === null);
  await p.evaluate(() => void (location.href = "https://evil.example/"));
  await sleep(600);
  check("S1 window.open to another site is denied and navigation away is blocked", popup && p.url().startsWith("app://topsim") && s.ctx.pages().length === 1, p.url());
  check("S1 page has no Node (require/process) and only the five bridge verbs", await p.evaluate(() => typeof (window as any).require === "undefined" && typeof (window as any).process === "undefined" && Object.keys((window as any).topsim).sort().join() === "chooseHandbook,chooseLectureFolder,clearHandbook,clearLectureFolder,copyCommand"));
  check("S1 CSP blocks a request to another site", (await p.evaluate(() => fetch("https://example.com/").then(() => "loaded", () => "blocked"))) === "blocked");
  const lsof = execFileSync("lsof", ["-nP", "-a", "-p", String(s.pid), "-iTCP", "-sTCP:LISTEN"], { encoding: "utf8" }).split("\n").slice(1).filter(Boolean);
  check("S1 the app opens no network port of its own (only the test's debug port listens)", lsof.every((l) => l.includes(`:${s.port}`)), `${lsof.length} listener(s)`);
  leaks.push(readFileSync(join(s.dir, "stderr.log"), "utf8"));
  await s.stop();
}

// ---- S2: relaunch with the same storage
{
  const s = await launch("s2-relaunch", { home: home1, userData: ud1 });
  const p = s.page;
  await p.locator("nav.sidebar").getByRole("button", { name: "Setup", exact: true }).waitFor({ timeout: 15000 });
  await sleep(2500);
  check("S2 setup does not open by itself again (dismissal remembered)", (await dialogOf(p).count()) === 0);
  await nav(p, "Dashboard");
  await p.locator("main.page").getByText(/Net income/i).first().waitFor({ timeout: 10000 });
  check("S2 the imported report survived the restart", await p.evaluate(async () => (await (await fetch("/api/periods")).json()).periods.length === 1));
  await shot(p, "07-dashboard-after-relaunch");
  noErrors("S2", s);
  await s.stop();
}

// ---- S3: installed but logged out
{
  const home = join(RUN, "home-loggedout");
  fakeClaude(home, "logged-out", join(RUN, "s3-logged-out", "claude"));
  mkdirSync(join(RUN, "s3-logged-out"), { recursive: true });
  const s = await launch("s3-logged-out", { home, userData: join(RUN, "userdata-s3") });
  await dialogOf(s.page).waitFor({ timeout: 20000 });
  const t = await setupText(s.page);
  check("S3 logged-out state: sign in only, no install step", /Claude is installed — sign in to finish/.test(t) && t.includes("claude auth login") && !t.includes(INSTALL) && /Version 2\.1\.289/.test(t));
  await shot(s.page, "08-setup-logged-out");
  await dialogOf(s.page).getByRole("button", { name: "Recheck" }).click();
  await sleep(1500);
  check("S3 Recheck keeps the state when nothing changed", /sign in to finish/.test(await setupText(s.page)));
  noErrors("S3", s);
  await s.stop();
}

// ---- S5: the check itself fails
{
  const home = join(RUN, "home-failed");
  mkdirSync(join(RUN, "s5-check-failed"), { recursive: true });
  fakeClaude(home, "fail", join(RUN, "s5-check-failed", "claude"));
  const s = await launch("s5-check-failed", { home, userData: join(RUN, "userdata-s5") });
  await dialogOf(s.page).waitFor({ timeout: 20000 });
  const t = await setupText(s.page);
  check("S5 check-failed state is shown with both instructions for reference", /could not be checked/.test(t) && t.includes(INSTALL) && t.includes("claude auth login"));
  await shot(s.page, "09-setup-check-failed");
  noErrors("S5", s);
  await s.stop();
}

// ---- S4: ready, with the user's own handbook + lecture folder
{
  const home = join(RUN, "home-ready");
  const ud = join(RUN, "userdata-s4");
  const lecture = join(RUN, "lecture");
  mkdirSync(join(RUN, "s4-ready"), { recursive: true });
  mkdirSync(join(ud, "sources"), { recursive: true });
  mkdirSync(lecture, { recursive: true });
  writeFileSync(join(ud, "sources/handbook.txt"), "SYNTHETIC HANDBOOK TEXT: the tax rate is 35 %.\n");
  writeFileSync(join(lecture, "Class Notes.md"), "SYNTHETIC LECTURE NOTE: CM II = revenue - variable costs\n");
  writeFileSync(join(ud, "settings.json"), JSON.stringify({ setupDismissed: false, lectureDir: lecture }));
  const log = join(RUN, "s4-ready", "claude");
  fakeClaude(home, "ready", log);
  const s = await launch("s4-ready", { home, userData: ud });
  const p = s.page;
  await p.locator("nav.sidebar").getByRole("button", { name: "Setup", exact: true }).waitFor({ timeout: 15000 });
  await sleep(2500);
  check("S4 no setup nag on first launch when Claude is already ready", (await dialogOf(p).count()) === 0);
  check("S4 the status checks never sent a question (no `-p` call yet)", !existsSync(`${log}.calls`) || !readFileSync(`${log}.calls`, "utf8").split("\n").some((l) => l.startsWith("-p")));
  await p.locator("nav.sidebar").getByRole("button", { name: "Setup", exact: true }).click();
  await dialogOf(p).waitFor();
  await p.getByText("Claude is ready").waitFor();
  const t = await setupText(p);
  check("S4 ready state, 'Done' button, own sources listed honestly", /Claude is ready/.test(t) && (await dialogOf(p).getByRole("button", { name: "Done" }).count()) === 1 && /Added · 47 characters/.test(t) && /1 note found/.test(t), t.match(/Added · [\d,]+ characters/)?.[0] ?? "");
  await shot(p, "10-setup-ready");
  await dialogOf(p).getByRole("button", { name: "Done" }).click();
  await p.evaluate(async (text) => void (await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) })), CM);
  await p.locator(".dock-toggle").click();
  await p.getByLabel("Ask the copilot").fill("Explain my CM");
  await p.getByRole("button", { name: "Ask", exact: true }).click();
  await p.locator(".msg.assistant").getByText("FAKE-ANSWER").waitFor({ timeout: 15000 });
  await shot(p, "11-copilot-answer");
  const args1 = readFileSync(`${log}.args`, "utf8");
  check("S4 only when asking: the copilot call carries reports + the user's own handbook and lecture note", args1.includes("[Handbook]") && args1.includes("SYNTHETIC HANDBOOK TEXT") && args1.includes("[Lecture: Class Notes.md]") && args1.includes("[Period 0 · TNB10"));
  // remove the handbook through the real Remove button (IPC) and ask again
  await p.locator("nav.sidebar").getByRole("button", { name: "Setup", exact: true }).click();
  await dialogOf(p).waitFor();
  await dialogOf(p).getByRole("button", { name: "Remove" }).first().click();
  await p.getByText(/Handbook\s*None added/).waitFor({ timeout: 5000 }).catch(() => undefined);
  check("S4 removing the handbook empties its slot", /Handbook\s*None added/.test(await setupText(p)));
  await dialogOf(p).getByRole("button", { name: "Done" }).click();
  await p.getByLabel("Ask the copilot").fill("And now?");
  await p.getByRole("button", { name: "Ask", exact: true }).click();
  await p.locator(".msg.assistant").nth(1).waitFor({ timeout: 15000 });
  const args2 = readFileSync(`${log}.args`, "utf8");
  check("S4 after removal the copilot is told there is no handbook (no fake source)", args2.includes("No handbook was supplied") && !args2.includes("SYNTHETIC HANDBOOK TEXT") && args2.includes("[Lecture: Class Notes.md]"));
  check("S4 sign-in details never reached the page (DOM text, API answers)", s.api.every((a) => !SECRETS.some((x) => a.body.includes(x))) && !(await p.evaluate(() => document.body.innerText)).match(/private@example|sk-fake/), `${s.api.length} API responses`);
  noErrors("S4", s);
  leaks.push(readFileSync(join(s.dir, "stderr.log"), "utf8"), readFileSync(join(s.dir, "stdout.log"), "utf8"));
  await s.stop();
}
// ---- S6: ZIP upload through the real Upload tab (pdf.js worker under app://), private fixture at run time only
{
  const ud = join(RUN, "userdata-s6");
  const s = await launch("s6-zip-upload", { home: home1, userData: ud });
  const p = s.page;
  await dialogOf(p).waitFor({ timeout: 20000 });
  await dialogOf(p).getByRole("button", { name: "Skip for now" }).click();
  await nav(p, "Import");
  await p.locator('input[type="file"]').setInputFiles(join(process.cwd(), "tests/fixtures/p0-reports.zip"));
  const saveBtn = p.getByRole("button", { name: /^Save \d+ reports? to vault$/ });
  await saveBtn.waitFor({ timeout: 60000 });
  await shot(p, "12-upload-zip-checked");
  const label = await saveBtn.innerText();
  await saveBtn.click();
  await p.getByText(/All saved/).first().waitFor({ timeout: 30000 });
  const file = JSON.parse(readFileSync(join(ud, "reports/data/period-0.json"), "utf8"));
  check("S6 the TOPSIM ZIP (16 PDFs) is read by pdf.js in the packaged app and saved", Object.keys(file.reports).length === 16, `${label}; ${Object.keys(file.reports).length} reports on disk`);
  await shot(p, "13-upload-zip-saved");
  noErrors("S6", s);
  await s.stop();
}
check("No secret from the stand-in auth answer appears in any page text or app log", leaks.every((l) => !SECRETS.some((x) => l.includes(x))));

writeFileSync(join(RUN, "results.json"), JSON.stringify({ arch: ARCH, app: APP, run: RUN, screenshots: shots, checks }, null, 2));
const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed\nresults: ${join(RUN, "results.json")}\nscreenshots: ${SHOTS}`);
process.exit(failed.length ? 1 : 0);
