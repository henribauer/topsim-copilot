import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { handleApi, type ApiContext } from "../src/server/api";
import { p0Report } from "./fixtures";

const CM = p0Report("=== Report11_Contribution Margin.pdf", "=== ");

function ctx(extra: Partial<ApiContext> = {}): ApiContext {
  return { vaultDir: mkdtempSync(join(tmpdir(), "topsim-api-")), copilot: () => ({ vaultDir: "" }), ...extra };
}
const req = (method: string, path: string, body = "", origin: string | undefined = "app://topsim") => ({ method, path, body, origin });

describe("handleApi — the one router behind the dev server and the desktop app", () => {
  it("saves a posted report and reads it back through GET /api/periods", async () => {
    const c = ctx();
    const saved = await handleApi(c, req("POST", "/api/reports", JSON.stringify({ text: CM })));
    expect(saved).toEqual({ status: 200, body: { ok: true, period: 0, reportCode: "TNB10", note: "Period 0.md" } });
    const periods = await handleApi(c, req("GET", "/api/periods"));
    expect(periods.status).toBe(200);
    expect((periods.body.periods as { period: number }[]).map((p) => p.period)).toEqual([0]);
  });

  it("refuses a foreign Origin on every route that spends quota or writes, and writes nothing", async () => {
    const c = ctx();
    for (const [method, path] of [["POST", "/api/reports"], ["POST", "/api/corrections"], ["DELETE", "/api/corrections"], ["POST", "/api/copilot"]]) {
      const res = await handleApi(c, req(method, path, JSON.stringify({ text: CM }), "https://evil.example"));
      expect(res.status, `${method} ${path}`).toBe(403);
    }
    expect(existsSync(join(c.vaultDir, "data"))).toBe(false);
  });

  it("answers 405 for a wrong method and 404 for an unknown path", async () => {
    const c = ctx();
    expect((await handleApi(c, req("GET", "/api/reports"))).status).toBe(405);
    expect((await handleApi(c, req("POST", "/api/periods"))).status).toBe(405);
    expect((await handleApi(c, req("GET", "/api/nope"))).status).toBe(404);
  });
});

import { vi } from "vitest";
import { readBody, type AppServices } from "../src/server/api";

describe("app routes — present only in the desktop app", () => {
  const status = { state: "missing" as const, installed: false, signedIn: null, version: null, message: "x" };
  const makeApp = (): AppServices => ({
    info: () => ({ dataDir: "/data", setupDismissed: false, handbook: { present: false, chars: 0 }, lecture: { dir: null, notes: 0 } }),
    setSetupDismissed: vi.fn(),
    claudeStatus: async () => status,
  });

  it("says it is not the desktop app on the dev server, which has no setup routes", async () => {
    const c = ctx();
    expect(await handleApi(c, req("GET", "/api/app"))).toEqual({ status: 200, body: { desktop: false } });
    expect((await handleApi(c, req("GET", "/api/claude/status"))).status).toBe(404);
    expect((await handleApi(c, req("POST", "/api/app/setup", '{"dismissed":true}'))).status).toBe(404);
  });

  it("reports app info and the Claude status in the desktop app", async () => {
    const c = ctx({ app: makeApp() });
    const info = await handleApi(c, req("GET", "/api/app"));
    expect(info.body).toMatchObject({ desktop: true, dataDir: "/data", setupDismissed: false });
    expect((await handleApi(c, req("GET", "/api/claude/status"))).body).toEqual(status);
  });

  it("remembers a dismissed setup — only from the app's own origin, only for a well-formed body", async () => {
    const app = makeApp();
    const c = ctx({ app });
    expect((await handleApi(c, req("POST", "/api/app/setup", '{"dismissed":true}'))).status).toBe(200);
    expect(app.setSetupDismissed).toHaveBeenCalledWith(true);
    expect((await handleApi(c, req("POST", "/api/app/setup", "{}"))).status).toBe(400);
    expect((await handleApi(c, req("POST", "/api/app/setup", '{"dismissed":false}', "https://evil.example"))).status).toBe(403);
    expect(app.setSetupDismissed).toHaveBeenCalledTimes(1);
  });
});

describe("readBody — request bodies are bounded", () => {
  async function* chunks(...parts: string[]) {
    for (const p of parts) yield new TextEncoder().encode(p);
  }
  it("joins the chunks into text", async () => {
    expect(await readBody(chunks('{"a":', '"ä"}'))).toBe('{"a":"ä"}');
  });
  it("gives up (null) as soon as the body is larger than the limit", async () => {
    expect(await readBody(chunks("12345", "67890", "x"), 10)).toBeNull();
    expect(await readBody(chunks("12345", "67890"), 10)).toBe("1234567890");
  });
});
