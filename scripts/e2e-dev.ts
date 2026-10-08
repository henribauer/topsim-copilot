// Regression check of the browser dev launcher (npm run dev): same screens as before, no Setup button, API still works.
// Scratch vault only (TOPSIM_VAULT). Run: npx vite-node scripts/e2e-dev.ts
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const CHROME = "/Users/henri/Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const dir = join(homedir(), ".hermes/cache/scratch/topsim-dev-e2e");
mkdirSync(dir, { recursive: true });
const vault = join(dir, "vault");
const PORT = 5198;
const sample = readFileSync(join(process.cwd(), "docs/p0_reports_sample.txt"), "utf8");
const texts = sample.split("\n").filter((l) => l.startsWith("=== Report")).map((m) => sample.split(m)[1].split("=== ")[0]);
let failed = 0;
const check = (name: string, ok: boolean, d = "") => (console.log(`${ok ? "PASS" : "FAIL"}  ${name}${d ? ` — ${d}` : ""}`), ok || failed++);

const vite = spawn("npx", ["vite", "--port", String(PORT), "--host", "127.0.0.1", "--strictPort"], { env: { ...process.env, TOPSIM_VAULT: vault, TOPSIM_COURSE: join(dir, "no-course") }, stdio: "ignore", detached: true });
const stopVite = () => { try { process.kill(-vite.pid!, "SIGKILL"); } catch { /* already gone */ } };
process.on("exit", stopVite);
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(`http://127.0.0.1:${PORT}/api/app`)).ok) break;
  } catch {
    /* starting */
  }
  await new Promise((r) => setTimeout(r, 250));
}
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const errors: string[] = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://127.0.0.1:${PORT}/`);
await page.waitForSelector("nav.sidebar");
check("dev: /api/app says it is not the desktop app", (await page.evaluate(async () => (await (await fetch("/api/app")).json()).desktop)) === false);
check("dev: no Setup button and no setup dialog (screens unchanged)", (await page.locator("nav.sidebar").getByRole("button", { name: "Setup", exact: true }).count()) === 0 && (await page.getByRole("dialog").count()) === 0);
const saved = await page.evaluate(async (ts) => {
  let ok = 0;
  for (const text of ts) ok += (await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) })).ok ? 1 : 0;
  return ok;
}, texts);
check("dev: 16/16 reports save into the scratch vault", saved === texts.length && existsSync(join(vault, "data/period-0.json")), `${saved}/${texts.length}`);
await page.reload();
await page.locator("main.page").getByText(/Net income/i).first().waitFor({ timeout: 10000 });
await page.screenshot({ path: join(dir, "dev-dashboard.png") });
for (const n of ["Analysis", "Planner", "What-if", "Quiz", "Glossary", "Import"]) {
  await page.locator("nav.sidebar").getByRole("button", { name: n, exact: true }).click();
  await page.waitForTimeout(200);
}
check("dev: all pages open with zero console errors", errors.length === 0, errors.join(" | "));
const foreign = await fetch(`http://127.0.0.1:${PORT}/api/reports`, { method: "POST", headers: { Origin: "https://evil.example", "Content-Type": "application/json" }, body: "{}" });
check("dev: foreign Origin still refused (403)", foreign.status === 403);
const big = await fetch(`http://127.0.0.1:${PORT}/api/reports`, { method: "POST", body: "a".repeat(3 * 1024 * 1024) });
check("dev: oversized body refused (413)", big.status === 413);
await browser.close();
stopVite();
console.log(`screenshot: ${join(dir, "dev-dashboard.png")}`);
process.exit(failed ? 1 : 0);
