import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { breakEven, cmCascade, competitorTable, costPerUnit, periodChange } from "../src/analysis/analysis";
import { loadPeriods, saveReport, type PeriodFile } from "../src/store/periodStore";
import { p0Report } from "./fixtures";

const CM = p0Report("=== Report11_Contribution Margin.pdf", "=== ");
const COST_UNIT = p0Report("=== Report10_Cost Unit Accounting.pdf", "=== ");
const MARKET = p0Report("=== Report2_Market Research Report.pdf", "=== ");

/** Period 0 as the app really stores it: the three reports saved into a vault and loaded back. */
function p0(): PeriodFile {
  const dir = mkdtempSync(join(tmpdir(), "topsim-analysis-"));
  for (const text of [CM, COST_UNIT, MARKET]) saveReport(dir, text);
  return loadPeriods(dir)[0];
}

describe("cmCascade (Contribution Margin report, Total column)", () => {
  it("lists every step in report order with its total and its per-unit value", () => {
    const c = cmCascade(p0())!;
    expect(c.unit).toBe("TEUR");
    expect(c.steps).toHaveLength(16);
    expect(c.steps[0]).toEqual({ label: "Sales Revenue", kind: "revenue", total: 6000, perUnit: 150 });
    expect(c.steps[4]).toEqual({ label: "Contribution Margin I", kind: "margin", total: 3320, perUnit: 83 });
    expect(c.steps[15]).toEqual({ label: "Contribution Margin V", kind: "margin", total: 421.01, perUnit: 10.53 });
  });

  it("reads the Total column, not the first channel, when several channels sell; and ignores a per-unit page of another shape", () => {
    const p = structuredClone(p0());
    const cm = p.reports.TNB10.parsed as unknown as {
      steps: { label: string; values: number[] }[];
      perUnit: { steps: { label: string; values: number[] }[] };
    };
    cm.steps[0].values = [4000, 2000, 0, 0, 0, 6000]; // online 4,000 + bulk buyer 2,000
    expect(cmCascade(p)!.steps[0].total).toBe(6000);
    cm.perUnit.steps.pop(); // a per-unit table that no longer lines up row by row must not be paired with the totals
    expect(cmCascade(p)!.steps.map((s) => s.perUnit)).toEqual(Array(16).fill(null));
  });

  it("is null when the period has no Contribution Margin report", () => {
    expect(cmCascade({ period: 3, company: "Company 2", reports: {} })).toBeNull();
  });
});

describe("breakEven (multi-stage CM: variable costs = everything above CM I)", () => {
  it("derives units sold, contribution margin per unit, fixed costs and the break-even point from the CM report", () => {
    const b = breakEven(p0())!;
    expect(b.unitsSold).toBe(40000); // revenue 6,000 TEUR ÷ price EUR 150
    expect(b.pricePerUnit).toBe(150);
    expect(b.variableCostPerUnit).toBe(67); // 38 + 26 + 3
    expect(b.cmPerUnit).toBe(83);
    expect(b.fixedCosts).toBeCloseTo(2898.98, 2); // 199.51 + 1,037.07 + 300 + 640 + 0 + 536.20 + 186.20
    expect(b.breakEvenUnits).toBe(34928); // 2,898,980 ÷ 83 = 34,927.5 → the next whole unit
    expect(b.breakEvenRevenue).toBeCloseTo(5239.2, 1);
    expect(b.safetyUnits).toBe(5072);
    expect(b.safetyPct).toBeCloseTo(12.68, 2);
  });

  it("returns null when the contribution margin per unit is not positive (no break-even exists)", () => {
    const loss = structuredClone(p0());
    const cm = loss.reports.TNB10.parsed as unknown as { perUnit: { steps: { label: string; values: number[] }[] } };
    cm.perUnit.steps.find((s) => s.label === "Contribution Margin I")!.values = [0, 0, 0, 0, 0, -5];
    expect(breakEven(loss)).toBeNull();
  });
});

describe("costPerUnit (Cost Unit Accounting, per unit)", () => {
  it("returns the per-unit cost steps in report order", () => {
    const c = costPerUnit(p0())!;
    expect(c.find((s) => s.label === "Cost of Goods Manufactured")).toEqual({ label: "Cost of Goods Manufactured", sign: "=", value: 94.91 });
    expect(c.at(-1)).toEqual({ label: "Total Costs of Goods Sold", sign: "=", value: 139.47 });
    // TOPSIM rounds every per-unit figure to cents, so the parts differ from the printed total by a cent or two.
    const parts = c.filter((s) => s.sign === "+").map((s) => s.value).reduce((a, b) => a + b, 0);
    expect(Math.abs(parts - 139.47)).toBeLessThan(0.05);
    expect(c.find((s) => s.label === "Production Direct Costs")!.value).toBe(26);
  });
});

describe("periodChange (variance table, latest vs previous period)", () => {
  function twoPeriods(): PeriodFile[] {
    const a = p0();
    const b = structuredClone(a);
    b.period = 1;
    const steps = (b.reports.TNB10.parsed as unknown as { steps: { label: string; values: number[] }[] }).steps;
    steps.find((s) => s.label === "Sales Revenue")!.values = [6600, 0, 0, 0, 0, 6600];
    steps.find((s) => s.label === "Advertising Costs")!.values = [330, 0, 0, 0, 0, 330];
    return [a, b];
  }

  it("compares every CM step: previous, latest, absolute and percent change", () => {
    const v = periodChange(twoPeriods())!;
    expect(v.previousPeriod).toBe(0);
    expect(v.latestPeriod).toBe(1);
    const rev = v.rows.find((r) => r.label === "Sales Revenue")!;
    expect(rev).toMatchObject({ previous: 6000, latest: 6600, abs: 600, pct: 10 });
  });

  it("marks a change favorable or unfavorable by what the row means: more revenue is good, more cost is bad", () => {
    const v = periodChange(twoPeriods())!;
    expect(v.rows.find((r) => r.label === "Sales Revenue")!.favorable).toBe(true);
    expect(v.rows.find((r) => r.label === "Advertising Costs")!.favorable).toBe(false);
    expect(v.rows.find((r) => r.label === "Transport Costs")!.favorable).toBeNull(); // unchanged
  });

  it("has no percent when the previous value was 0, and measures a change from a negative value against its size", () => {
    const [a, b] = twoPeriods();
    const stepsA = (a.reports.TNB10.parsed as unknown as { steps: { label: string; values: number[] }[] }).steps;
    stepsA.find((s) => s.label === "Research Costs")!.values = [0];
    (b.reports.TNB10.parsed as unknown as { steps: { label: string; values: number[] }[] }).steps.find((s) => s.label === "Research Costs")!.values = [50];
    stepsA.find((s) => s.label === "Contribution Margin V")!.values = [-200];
    (b.reports.TNB10.parsed as unknown as { steps: { label: string; values: number[] }[] }).steps.find((s) => s.label === "Contribution Margin V")!.values = [-100];
    const rows = periodChange([a, b])!.rows;
    expect(rows.find((r) => r.label === "Research Costs")).toMatchObject({ abs: 50, pct: null });
    expect(rows.find((r) => r.label === "Contribution Margin V")).toMatchObject({ abs: 100, pct: 50, favorable: true });
  });

  it("compares the two latest periods whatever order they arrive in", () => {
    const [a, b] = twoPeriods();
    const c = structuredClone(b);
    c.period = 2;
    const v = periodChange([c, a, b])!;
    expect([v.previousPeriod, v.latestPeriod]).toEqual([1, 2]);
    expect(periodChange([b, a])!.latestPeriod).toBe(1);
  });

  it("is null with fewer than two periods", () => {
    expect(periodChange([p0()])).toBeNull();
  });
});

describe("competitorTable (Market Research report, first section)", () => {
  it("lists price, quality, advertising, awareness and sales per company and finds our column", () => {
    const t = competitorTable(p0())!;
    expect(t.columns).toEqual(["C1", "C2", "C3", "C4"]);
    expect(t.ourColumn).toBe(1); // "Company 2"
    const price = t.rows.find((r) => r.label === "Price")!;
    expect(price.unit).toBe("EUR");
    expect(price.values.map((v) => v.raw)).toEqual(["150", "150", "150", "150"]);
    expect(t.rows.map((r) => r.label)).toEqual(expect.arrayContaining(["Advertising", "Awareness Index", "Market Share"]));
  });
});
