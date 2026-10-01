import type { PeriodFile } from "../store/periodStore";
import { breakEven, cmCascade, competitorTable, costPerUnit, periodChange } from "./analysis";

/**
 * What the Analysis page shows first (redesign step 3, design guide R3; Mobbin: Vercel, Mintlify, Calendly,
 * Squarespace in docs/mobbin/analysis.json): three headline numbers, then one topic at a time behind tabs.
 * Everything is read from the saved reports; what a period cannot answer is left out, not shown as a dash.
 */
export interface Headlines {
  operatingResult: { label: string; sublabel: string; value: number; unit: string };
  breakEven?: { units: number; safetyUnits: number; safetyPct: number };
  costPerUnit?: { value: number; unit: string };
}

export function analysisHeadlines(p: PeriodFile): Headlines | null {
  const cascade = cmCascade(p);
  const cm5 = cascade?.steps.find((s) => s.label === "Contribution Margin V");
  if (!cascade || !cm5) return null;

  const be = breakEven(p);
  // The last step of the cost-per-unit table is the full cost of one headphone sold.
  const unit = costPerUnit(p)?.at(-1);
  return {
    operatingResult: { label: "Operating result", sublabel: "Contribution margin V", value: cm5.total, unit: cascade.unit },
    ...(be ? { breakEven: { units: be.breakEvenUnits, safetyUnits: be.safetyUnits, safetyPct: be.safetyPct } } : {}),
    ...(unit ? { costPerUnit: { value: unit.value, unit: "EUR" } } : {}),
  };
}

export type TabId = "cascade" | "breakeven" | "cost" | "change" | "competitors";

export interface AnalysisTab {
  id: TabId;
  label: string;
}

/** The tabs that have something to show for this period, in reading order. */
export function analysisTabs(periods: PeriodFile[], p: PeriodFile): AnalysisTab[] {
  const tabs: AnalysisTab[] = [{ id: "cascade", label: "Margin cascade" }];
  if (breakEven(p)) tabs.push({ id: "breakeven", label: "Break-even" });
  if (costPerUnit(p)) tabs.push({ id: "cost", label: "Cost per unit" });
  // Only periods up to this one count: looking at period 0 has nothing earlier to compare with.
  if (periodChange(periods.filter((x) => x.period <= p.period))) tabs.push({ id: "change", label: "Period vs period" });
  if (competitorTable(p)) tabs.push({ id: "competitors", label: "Competitors" });
  return tabs;
}
