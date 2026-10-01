import { mkdtempSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPeriods, removeCorrection, saveCorrection, saveReport } from "../src/store/periodStore";
import { p0Report } from "./fixtures";

const CM = p0Report("=== Report11_Contribution Margin.pdf", "=== ");
const BS = p0Report("=== Report16_Balance Sheet.pdf", "=== ");
const NOW = new Date("2026-10-01T10:00:00Z");

function vault(): string {
  return mkdtempSync(join(tmpdir(), "topsim-vault-"));
}

describe("loadPeriods", () => {
  it("returns every saved period file sorted by period, and [] for an empty vault", () => {
    const dir = vault();
    expect(loadPeriods(dir)).toEqual([]);
    saveReport(dir, CM, NOW);
    saveReport(dir, BS.replace("Period: 0", "Period: 1"), NOW);
    writeFileSync(join(dir, "data", "notes.txt"), "not a period file");

    const periods = loadPeriods(dir);
    expect(periods.map((p) => p.period)).toEqual([0, 1]);
    expect(Object.keys(periods[0].reports)).toEqual(["TNB10"]);
  });
});

describe("saveReport", () => {
  it("writes the parsed report and its raw text into data/period-<n>.json", () => {
    const dir = vault();
    const result = saveReport(dir, CM, NOW);

    expect(result.jsonPath).toBe(join(dir, "data", "period-0.json"));
    const data = JSON.parse(readFileSync(result.jsonPath, "utf8"));
    expect(data.period).toBe(0);
    expect(data.company).toBe("Company 2");
    expect(data.reports.TNB10.kind).toBe("cm");
    expect(data.reports.TNB10.savedAt).toBe("2026-10-01T10:00:00.000Z");
    expect(data.reports.TNB10.raw).toBe(CM);
    expect(data.reports.TNB10.parsed.reportCode).toBe("TNB10");
    expect(existsSync(result.jsonPath)).toBe(true);
  });

  it("adds further reports of the same period to the same file and replaces a re-saved one", () => {
    const dir = vault();
    saveReport(dir, CM, NOW);
    saveReport(dir, BS, NOW);
    const later = new Date("2026-10-02T08:00:00Z");
    const { jsonPath } = saveReport(dir, CM, later);

    const data = JSON.parse(readFileSync(jsonPath, "utf8"));
    expect(Object.keys(data.reports).sort()).toEqual(["TNB10", "TNB15"]);
    expect(data.reports.TNB10.savedAt).toBe("2026-10-02T08:00:00.000Z");
    expect(data.reports.TNB15.kind).toBe("bs");
  });

  it("writes a readable vault note 'Period <n>.md' listing every report saved so far", () => {
    const dir = vault();
    saveReport(dir, CM, NOW);
    const { notePath } = saveReport(dir, BS, NOW);

    expect(notePath).toBe(join(dir, "Period 0.md"));
    const note = readFileSync(notePath, "utf8");
    expect(note).toMatch(/^---\nperiod: 0\ncompany: Company 2\nreports: \[TNB10, TNB15\]\n---\n/);
    expect(note).toContain("# Period 0");
    expect(note).toContain("| TNB10 | Contribution Margin | 2026-10-01 |");
    expect(note).toContain("| TNB15 | Balance Sheet | 2026-10-01 |");
    expect(note).toContain("data/period-0.json");
  });

  it("refuses text that is not a supported report and writes nothing", () => {
    const dir = vault();
    expect(() => saveReport(dir, "hello", NOW)).toThrow(/No supported report header/);
    expect(existsSync(join(dir, "data"))).toBe(false);
  });
});

describe("saveCorrection", () => {
  const path = ["sections", 0, "rows", 0, "value"];
  const fix = { path, from: 1, to: "2.00", at: "2026-10-01T11:00:00.000Z" };

  it("stores a fix next to its report and keeps it when the same report is imported again", () => {
    const dir = vault();
    saveReport(dir, CM, NOW);
    saveCorrection(dir, 0, "TNB10", fix);
    saveReport(dir, CM, new Date("2026-10-02T08:00:00Z"));

    const [p0] = loadPeriods(dir);
    expect(p0.reports.TNB10.corrections).toEqual([fix]);
    expect(p0.reports.TNB10.raw).toBe(CM);
  });

  it("replaces an earlier fix of the same cell, and undo removes only that cell's fix", () => {
    const dir = vault();
    saveReport(dir, CM, NOW);
    const other = { ...fix, path: ["sections", 0, "rows", 1, "value"] };
    saveCorrection(dir, 0, "TNB10", fix);
    saveCorrection(dir, 0, "TNB10", other);
    saveCorrection(dir, 0, "TNB10", { ...fix, to: "3.00" });
    expect(loadPeriods(dir)[0].reports.TNB10.corrections).toEqual([other, { ...fix, to: "3.00" }]);

    removeCorrection(dir, 0, "TNB10", path);
    expect(loadPeriods(dir)[0].reports.TNB10.corrections).toEqual([other]);
  });
});
