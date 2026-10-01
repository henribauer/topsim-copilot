import { describe, expect, it } from "vitest";
import { analysisHeadlines, analysisTabs } from "../src/analysis/overview";
import type { PeriodFile } from "../src/store/periodStore";
import { savedP0 } from "./fixtures";

/**
 * Redesign step 3 (design guide R3). Mobbin refs docs/mobbin/analysis.json: Vercel (the KPI is the tab that drives
 * the chart), Mintlify (one chart, plain tables), Calendly (headline cards first, supporting views second),
 * Squarespace (tab bar directly under the title). Headline numbers first, then one topic at a time.
 */
describe("analysisHeadlines", () => {
  const h = analysisHeadlines(savedP0())!;

  it("leads with the operating result (contribution margin V), exactly as TOPSIM printed it", () => {
    expect(h.operatingResult).toEqual({ label: "Operating result", sublabel: "Contribution margin V", value: 421.01, unit: "TEUR" });
  });

  it("gives the break-even quantity with the margin of safety beside it", () => {
    expect(h.breakEven).toEqual({ units: 34928, safetyUnits: 5072, safetyPct: 12.68 });
  });

  it("gives the full cost of one headphone sold (cost of goods sold plus R&D, sales and administration)", () => {
    expect(h.costPerUnit).toEqual({ value: 139.47, unit: "EUR" });
  });

  it("omits what the reports cannot answer instead of showing a dash", () => {
    const p: PeriodFile = JSON.parse(JSON.stringify(savedP0()));
    delete p.reports.TNB09;
    expect(analysisHeadlines(p)!.costPerUnit).toBeUndefined();
  });

  it("omits break-even when the contribution margin per unit is zero or negative (nothing can cover the fixed costs)", () => {
    const p: PeriodFile = JSON.parse(JSON.stringify(savedP0()));
    const cm = p.reports.TNB10.parsed as unknown as { perUnit: { steps: { label: string; values: number[] }[] } };
    cm.perUnit.steps.find((x) => x.label === "Contribution Margin I")!.values = [-5, 0, 0, 0, 0, -5];
    expect(analysisHeadlines(p)!.breakEven).toBeUndefined();
    expect(analysisTabs([p], p).map((x) => x.id)).not.toContain("breakeven");
  });

  it("still gives the headlines when the contribution margin V step exists but nothing else does", () => {
    const p: PeriodFile = JSON.parse(JSON.stringify(savedP0()));
    delete p.reports.TNB09;
    const h = analysisHeadlines(p)!;
    expect(h.operatingResult.value).toBe(421.01);
  });

  it("is null when the report has no contribution margin V step", () => {
    const p: PeriodFile = JSON.parse(JSON.stringify(savedP0()));
    const cm = p.reports.TNB10.parsed as unknown as { steps: { label: string }[]; perUnit: { steps: { label: string }[] } };
    cm.steps = cm.steps.filter((x) => x.label !== "Contribution Margin V");
    cm.perUnit.steps = cm.perUnit.steps.filter((x) => x.label !== "Contribution Margin V");
    expect(analysisHeadlines(p)).toBeNull();
  });

  it("is null without the contribution margin report, because nothing else on the page works without it", () => {
    const p: PeriodFile = JSON.parse(JSON.stringify(savedP0()));
    delete p.reports.TNB10;
    expect(analysisHeadlines(p)).toBeNull();
  });
});

describe("analysisTabs", () => {
  it("offers the cascade first, then break-even, cost per unit and competitors for a single period", () => {
    expect(analysisTabs([savedP0()], savedP0()).map((t) => t.id)).toEqual(["cascade", "breakeven", "cost", "competitors"]);
  });

  it("adds period-vs-period only when there is an earlier period to compare with", () => {
    const p1: PeriodFile = { ...JSON.parse(JSON.stringify(savedP0())), period: 1 };
    const tabs = analysisTabs([savedP0(), p1], p1).map((t) => t.id);
    expect(tabs).toEqual(["cascade", "breakeven", "cost", "change", "competitors"]);
    expect(analysisTabs([savedP0(), p1], savedP0()).map((t) => t.id)).not.toContain("change");
  });

  it("drops tabs whose report is missing", () => {
    const p: PeriodFile = JSON.parse(JSON.stringify(savedP0()));
    delete p.reports.TNB09;
    delete p.reports.TNB02;
    expect(analysisTabs([p], p).map((t) => t.id)).toEqual(["cascade", "breakeven"]);
  });

  it("labels the tabs in plain words", () => {
    expect(analysisTabs([savedP0()], savedP0()).map((t) => t.label)).toEqual(["Margin cascade", "Break-even", "Cost per unit", "Competitors"]);
  });
});
