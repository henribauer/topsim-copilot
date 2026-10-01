import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { handlePeriodsRequest, handleSaveRequest } from "../src/store/saveApi";
import { p0Report } from "./fixtures";

const CM = p0Report("=== Report11_Contribution Margin.pdf", "=== ");
const LOCAL = "http://127.0.0.1:5181";

describe("handleSaveRequest (POST /api/reports)", () => {
  it("saves the posted report text and answers with the period and report code", () => {
    const dir = mkdtempSync(join(tmpdir(), "topsim-vault-"));
    const res = handleSaveRequest(dir, JSON.stringify({ text: CM }), LOCAL);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, period: 0, reportCode: "TNB10", note: "Period 0.md" });
    expect(existsSync(join(dir, "data", "period-0.json"))).toBe(true);
  });

  it("answers 400 with the parser's message for text that is not a report", () => {
    const dir = mkdtempSync(join(tmpdir(), "topsim-vault-"));
    const res = handleSaveRequest(dir, JSON.stringify({ text: "hello" }), LOCAL);
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(String(res.body.error)).toMatch(/No supported report header/);
  });

  it("answers 400 for a body that is not {text: string}", () => {
    const dir = mkdtempSync(join(tmpdir(), "topsim-vault-"));
    expect(handleSaveRequest(dir, "not json", LOCAL).status).toBe(400);
    expect(handleSaveRequest(dir, JSON.stringify({ text: 5 }), LOCAL).status).toBe(400);
  });

  it("refuses requests sent from another website (403) and writes nothing", () => {
    const dir = mkdtempSync(join(tmpdir(), "topsim-vault-"));
    const res = handleSaveRequest(dir, JSON.stringify({ text: CM }), "https://evil.example");
    expect(res.status).toBe(403);
    expect(existsSync(join(dir, "data"))).toBe(false);
    expect(handleSaveRequest(dir, JSON.stringify({ text: CM }), "http://localhost:5181").status).toBe(200);
  });
});

describe("handlePeriodsRequest (GET /api/periods)", () => {
  it("lists the saved periods with parsed data but without the raw pasted text", () => {
    const dir = mkdtempSync(join(tmpdir(), "topsim-vault-"));
    expect(handlePeriodsRequest(dir)).toEqual({ status: 200, body: { periods: [] } });
    handleSaveRequest(dir, JSON.stringify({ text: CM }), LOCAL);

    const { status, body } = handlePeriodsRequest(dir);
    const periods = body.periods as { period: number; reports: Record<string, { raw?: string; parsed: { title: string } }> }[];
    expect(status).toBe(200);
    expect(periods.map((p) => p.period)).toEqual([0]);
    expect(periods[0].reports.TNB10.parsed.title).toBe("Contribution Margin");
    expect(periods[0].reports.TNB10.raw).toBeUndefined();
  });
});
