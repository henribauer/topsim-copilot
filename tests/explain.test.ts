import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cmCascade, breakEven } from "../src/analysis/analysis";
import { explainBreakEven, explainCmStep, waterfall } from "../src/analysis/explain";
import { loadPeriods, saveReport } from "../src/store/periodStore";
import { p0Report } from "./fixtures";

function p0() {
  const dir = mkdtempSync(join(tmpdir(), "topsim-explain-"));
  saveReport(dir, p0Report("=== Report11_Contribution Margin.pdf", "=== "));
  return loadPeriods(dir)[0];
}

describe("explainCmStep (concept + formula with this period's numbers filled in)", () => {
  it("shows CM II as CM I minus the fixed material and production costs, with the real values and TOPSIM's printed result", () => {
    const e = explainCmStep(cmCascade(p0())!, "Contribution Margin II")!;
    expect(e.title).toBe("Contribution Margin II");
    expect(e.formula).toBe("Contribution Margin I − Fixed Material Costs − Fixed Production Costs");
    // The worked line shows the numbers as printed; TOPSIM computes with unrounded values, so the displayed
    // parts add up to 2,083.42 while the report prints 2,083.41.
    expect(e.worked).toBe("3,320.00 − 199.51 − 1,037.07 = 2,083.41 TEUR");
    expect(e.concept).toMatch(/fixed/i);
    expect(e.checks).toBe(true); // within a cent of rounding
    expect(e.note).toBeNull();
  });

  it("explains CM I from revenue minus the three variable cost blocks", () => {
    const e = explainCmStep(cmCascade(p0())!, "Contribution Margin I")!;
    expect(e.worked).toBe("6,000.00 − 1,520.00 − 1,040.00 − 120.00 = 3,320.00 TEUR");
  });

  it("explains CM V as the operating result (CM IV minus research, sales and administration costs)", () => {
    const e = explainCmStep(cmCascade(p0())!, "Contribution Margin V")!;
    expect(e.worked).toBe("1,143.41 − 0.00 − 536.20 − 186.20 = 421.01 TEUR");
    expect(e.concept).toMatch(/operating/i);
    expect(e.checks).toBe(true);
  });

  it("says so when the printed result differs from the arithmetic by more than rounding — e.g. after a misread number", () => {
    const p = p0();
    (p.reports.TNB10.parsed as unknown as { steps: { label: string; values: number[] }[] }).steps.find(
      (s) => s.label === "Fixed Material Costs",
    )!.values = [299.51, 0, 0, 0, 0, 299.51];
    const e = explainCmStep(cmCascade(p)!, "Contribution Margin II")!;
    expect(e.checks).toBe(false);
    expect(e.note).toMatch(/do not add up/);
    expect(e.note).toMatch(/99\.99 apart/);
  });

  it("returns null for a label that is not a contribution margin", () => {
    expect(explainCmStep(cmCascade(p0())!, "Sales Revenue")).toBeNull();
  });
});

describe("explainBreakEven", () => {
  it("walks from fixed costs and the margin per unit to the break-even quantity, each line with real numbers", () => {
    const e = explainBreakEven(breakEven(p0())!);
    expect(e.lines.map((l) => l.label)).toEqual([
      "Contribution margin per unit",
      "Fixed costs",
      "Break-even quantity",
      "Margin of safety",
    ]);
    expect(e.lines[0].worked).toBe("150.00 − 67.00 = 83.00 EUR per unit");
    expect(e.lines[1].worked).toBe("199.51 + 1,037.07 + 300.00 + 640.00 + 0.00 + 536.20 + 186.20 = 2,898.98 TEUR");
    expect(e.lines[2].worked).toBe("2,898,980 ÷ 83.00 = 34,927.47 → 34,928 units");
    expect(e.lines[3].worked).toBe("40,000 − 34,928 = 5,072 units (12.68 % of the units sold)");
  });
});

describe("waterfall (design guide D14: floating bars, Increase/Decrease/Total, dashed connectors)", () => {
  it("turns the cascade into floating bars: costs hang down from the running level, margins stand on zero", () => {
    const bars = waterfall(cmCascade(p0())!);
    expect(bars[0]).toMatchObject({ label: "Sales Revenue", type: "increase", from: 0, to: 6000 });
    expect(bars[1]).toMatchObject({ label: "Direct Material Costs", type: "decrease", from: 6000, to: 4480 });
    expect(bars[4]).toMatchObject({ label: "Contribution Margin I", type: "total", from: 0, to: 3320 });
    expect(bars.at(-1)).toMatchObject({ label: "Contribution Margin V", type: "total", from: 0, to: 421.01 });
    expect(bars).toHaveLength(16);
  });

  it("restarts from the printed margin, so a cent of rounding in the report never makes the chart drift", () => {
    const bars = waterfall(cmCascade(p0())!);
    // Running level after the fixed costs is 3,320 − 199.51 − 1,037.07 = 2,083.42; TOPSIM prints CM II as 2,083.41.
    expect(bars[6]).toMatchObject({ label: "Fixed Production Costs", type: "decrease", to: 2083.42 });
    expect(bars[7]).toMatchObject({ label: "Contribution Margin II", type: "total", to: 2083.41, connectFrom: 2083.41 });
    // The next cost hangs from the printed 2,083.41, not from the drifted 2,083.42.
    expect(bars[8]).toMatchObject({ label: "Advertising Costs", from: 2083.41, to: 1783.41 });
  });

  it("chains every bar to the level where the previous one ended (the dashed connector)", () => {
    const bars = waterfall(cmCascade(p0())!);
    expect(bars[1].connectFrom).toBe(6000);
    expect(bars[2].connectFrom).toBe(4480);
    expect(bars[4].connectFrom).toBe(3320); // a total starts a new level at its own value
  });
});
