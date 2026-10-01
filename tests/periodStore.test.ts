import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { saveReport } from "../src/store/periodStore";
import { p0Report } from "./fixtures";

const CM = p0Report("=== Report11_Contribution Margin.pdf", "=== ");
const BS = p0Report("=== Report16_Balance Sheet.pdf", "=== ");
const NOW = new Date("2026-10-01T10:00:00Z");

function vault(): string {
  return mkdtempSync(join(tmpdir(), "topsim-vault-"));
}

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
