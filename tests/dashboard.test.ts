import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dashboardKpis } from "../src/dashboard/kpis";
import type { SectionedReport } from "../src/parser/sectionedReport";
import { saveReport, type PeriodFile } from "../src/store/periodStore";
import { p0Report } from "./fixtures";

const ES = p0Report("=== Report1_Executive Summary.pdf", "=== ");

/** Period 0 as it lands in the vault after importing the Executive Summary. */
function period0(): PeriodFile {
  const dir = mkdtempSync(join(tmpdir(), "topsim-vault-"));
  const { jsonPath } = saveReport(dir, ES, new Date("2026-10-01T10:00:00Z"));
  return JSON.parse(readFileSync(jsonPath, "utf8"));
}

describe("dashboardKpis", () => {
  it("reads the headline KPIs from the Executive Summary, exactly as TOPSIM printed them", () => {
    const kpis = dashboardKpis([period0()]);

    expect(kpis.map((k) => k.label)).toEqual([
      "Success Value Index",
      "Total Revenue",
      "Net Income/Net Loss",
      "Market Share",
      "Actual Sales",
      "Return on Sales",
      "Equity",
      "Final Cash Balance",
      "Overdraft Loans",
    ]);
    const revenue = kpis[1];
    expect(revenue.unit).toBe("TEUR");
    expect(revenue.points).toEqual([{ period: 0, raw: "6,000.00", n: 6000 }]);
    expect(kpis[3].points[0].raw).toBe("25.00");
    expect(kpis[4].unit).toBe("Units");
    expect(revenue.delta).toBeUndefined();
  });

  it("compares the latest period with the one before: +Δ, %Δ and whether the change is good", () => {
    const p0 = period0();
    const p1 = withValues(period0(), 1, { "Total Revenue": 6600, "Overdraft Loans": 1500, "Final Cash Balance": 10 });
    // Saved out of order on purpose: the dashboard sorts by period.
    const kpis = dashboardKpis([p1, p0]);
    const byLabel = Object.fromEntries(kpis.map((k) => [k.label, k]));

    expect(byLabel["Total Revenue"].points.map((p) => p.period)).toEqual([0, 1]);
    expect(byLabel["Total Revenue"].delta).toEqual({ abs: 600, pct: 10, favorable: true });
    // More overdraft is bad even though the number went up (D8: colour follows meaning).
    expect(byLabel["Overdraft Loans"].delta?.favorable).toBe(false);
    expect(byLabel["Final Cash Balance"].delta).toEqual({ abs: 0, pct: 0, favorable: null });
  });
});

/** A copy of a period with a new period number and some Executive Summary values replaced. */
function withValues(file: PeriodFile, period: number, values: Record<string, number>): PeriodFile {
  const copy: PeriodFile = JSON.parse(JSON.stringify(file));
  copy.period = period;
  const report = copy.reports.TNB01.parsed as unknown as SectionedReport;
  for (const section of report.sections)
    for (const row of section.rows)
      if (row.label in values) row.values[0] = { raw: String(values[row.label]), n: values[row.label] };
  return copy;
}
