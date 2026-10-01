import { RULES } from "./constants";
import type { Forecast } from "./forecast";
import type { Decisions, Opening } from "./opening";

/**
 * What the Planner and What-if pin above the decision form (redesign step 4, design guide R4; Mobbin refs
 * docs/mobbin/planner.json: Claude calculator, Quicken, Churnkey, Origin): the outcome numbers stay in view while a
 * decision changes, instead of scrolling away below a long form.
 */
export interface Summary {
  netIncome: number;
  overdraft: number;
  usedUnits: number;
  /** What the lines and the staff (with 20 % overtime) can make, whichever is smaller. */
  limitUnits: number;
  usedPct: number;
  /** usedPct capped at 100 for drawing the bar. */
  barPct: number;
  status: "ok" | "tight" | "over";
  /** Problems TOPSIM would not accept as entered. */
  problems: number;
}

export function plannerSummary(f: Forecast, d: Decisions): Summary {
  const staffMax = Math.floor(d.productionStaff * RULES.unitsPerEmployee.value * (1 + RULES.maxOvertime.value));
  const limitUnits = Math.min(f.capacity, staffMax);
  // used * 100 / limit (not used / limit * 100): exactly 95 % must read as 95, not 94.99999999999999.
  const usedPct = limitUnits > 0 ? (d.production * 100) / limitUnits : 0;
  return {
    netIncome: f.netIncome,
    overdraft: f.overdraft,
    usedUnits: d.production,
    limitUnits,
    usedPct,
    barPct: Math.min(100, usedPct),
    status: d.production > limitUnits ? "over" : usedPct >= 95 ? "tight" : "ok",
    problems: f.checks.filter((c) => c.level === "error").length,
  };
}

export type NumField = "price" | "advertising" | "advisors" | "qualityIncrease" | "production" | "newLines" | "productionStaff";

export interface Range {
  min: number;
  max: number;
  step: number;
  /** Last period's decision: drawn as a tick on the track so Henri sees where he came from (design guide D22). */
  reference: number;
}

/**
 * Slider limits per decision. They only bound the slider; the number field still takes any value. Ranges grow so the
 * current value is always reachable. `last` is the previous period's decisions (the tick), `current` the plan being edited.
 */
export function sliderRange(key: NumField, o: Opening, last: Decisions, current: Decisions = last): Range {
  const base = ((): Omit<Range, "reference"> => {
    switch (key) {
      case "price":
        return { min: Math.round(o.price * 0.8), max: Math.round(o.price * 1.2), step: 1 };
      case "advertising":
        return { min: 0, max: Math.max(600, o.advertising * 2), step: 10 };
      case "advisors":
        return { min: 0, max: Math.max(20, o.advisors * 2), step: 1 };
      case "qualityIncrease":
        return { min: 0, max: RULES.maxQualityStep.value, step: 1 };
      case "production":
        return { min: 0, max: o.lines.reduce((s, l) => s + l.capacity, 0) + 3 * RULES.lineCapacity.value, step: 500 };
      case "productionStaff":
        return { min: 0, max: Math.ceil((o.lines.reduce((s, l) => s + l.capacity, 0) + 3 * RULES.lineCapacity.value) / RULES.unitsPerEmployee.value), step: 1 };
      case "newLines":
        return { min: 0, max: 3, step: 1 };
    }
  })();
  return { ...base, max: Math.max(base.max, current[key]), reference: last[key] };
}

/**
 * Index of the scenario to highlight in the comparison (D19): the highest net income among the plans TOPSIM would
 * accept. Null when there is nothing to compare, nothing is acceptable, or the best is a tie, so nothing is falsely
 * called best.
 */
export function bestScenario(forecasts: Forecast[]): number | null {
  if (forecasts.length < 2) return null;
  const ok = forecasts.map((f, i) => ({ f, i })).filter(({ f }) => !f.checks.some((c) => c.level === "error"));
  if (ok.length === 0) return null;
  const top = Math.max(...ok.map(({ f }) => f.netIncome));
  const winners = ok.filter(({ f }) => Math.abs(f.netIncome - top) < 0.005);
  return winners.length === 1 ? winners[0].i : null;
}
