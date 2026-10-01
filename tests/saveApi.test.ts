import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { handleCorrectionRequest, handlePeriodsRequest, handleSaveRequest } from "../src/store/saveApi";
import { p0Report } from "./fixtures";
import { loadPeriods } from "../src/store/periodStore";

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

describe("handleCorrectionRequest (POST /api/corrections)", () => {
  const fix = { path: ["sections", 0, "rows", 0, "value"], from: 6000, to: "6,100.00" };

  it("stores the fix and timestamps it server-side", () => {
    const dir = mkdtempSync(join(tmpdir(), "topsim-vault-"));
    handleSaveRequest(dir, JSON.stringify({ text: CM }), LOCAL);
    const res = handleCorrectionRequest(dir, JSON.stringify({ period: 0, reportCode: "TNB10", correction: fix }), LOCAL);
    expect(res.status).toBe(200);
    const [p0] = loadPeriods(dir);
    expect(p0.reports.TNB10.corrections![0].path).toEqual(fix.path);
    expect(p0.reports.TNB10.corrections![0].at).toBeTypeOf("string");
  });

  it("answers 400 for a wrong body and for a report that is not saved", () => {
    const dir = mkdtempSync(join(tmpdir(), "topsim-vault-"));
    handleSaveRequest(dir, JSON.stringify({ text: CM }), LOCAL);
    expect(handleCorrectionRequest(dir, "not json", LOCAL).status).toBe(400);
    expect(handleCorrectionRequest(dir, JSON.stringify({ period: 0, reportCode: "TNB10", correction: { ...fix, to: 5 } }), LOCAL).status).toBe(400);
    expect(handleCorrectionRequest(dir, JSON.stringify({ period: 3, reportCode: "TNB10", correction: fix }), LOCAL).status).toBe(400);
  });

  it("refuses requests sent from another website (403)", () => {
    const dir = mkdtempSync(join(tmpdir(), "topsim-vault-"));
    expect(handleCorrectionRequest(dir, JSON.stringify({ period: 0, reportCode: "TNB10", correction: fix }), "https://evil.example").status).toBe(403);
  });
});

describe("handlePeriodsRequest with corrections", () => {
  it("serves the corrected value to the dashboard and analysis, and reports a fix that no longer fits", () => {
    const dir = mkdtempSync(join(tmpdir(), "topsim-vault-"));
    handleSaveRequest(dir, JSON.stringify({ text: CM }), LOCAL);
    const path = ["steps", 0, "values", 5];
    handleCorrectionRequest(dir, JSON.stringify({ period: 0, reportCode: "TNB10", correction: { path, from: 6000, to: "6,100.00" } }), LOCAL);
    handleCorrectionRequest(dir, JSON.stringify({ period: 0, reportCode: "TNB10", correction: { path: ["steps", 1, "values", 5], from: 999, to: "1.00" } }), LOCAL);

    const { body } = handlePeriodsRequest(dir);
    const r = (body.periods as { reports: Record<string, { parsed: { steps: { values: number[] }[] }; stale?: unknown[] }> }[])[0].reports.TNB10;
    expect(r.parsed.steps[0].values[5]).toBe(6100);
    expect(r.parsed.steps[1].values[5]).toBe(1520); // the stale fix was not applied
    expect(r.stale).toHaveLength(1);
  });
});

