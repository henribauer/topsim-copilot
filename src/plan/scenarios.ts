import { RULES } from "./constants";
import type { Forecast } from "./forecast";
import { decisionsOf, type Decisions, type Opening } from "./opening";
import type { PeriodFile } from "../store/periodStore";

/**
 * The plan to start from: what was decided in the period that just ended (read from its decision protocol),
 * with no new lines and nothing scrapped. Without a protocol, the opening state stands in: same price,
 * advertising and staff, producing what was sold.
 */
export function defaultDecisions(last: PeriodFile, o: Opening): Decisions {
  const d = decisionsOf(last);
  if (d) return { ...d, qualityIncrease: 0, newLines: 0, scrapLines: [] };
  return {
    price: o.price,
    advertising: o.advertising,
    advisors: o.advisors,
    qualityIncrease: 0,
    production: o.baseUnits,
    newLines: 0,
    scrapLines: [],
    productionStaff: o.workforce.production,
  };
}

/** Whole production employees that make `units` without overtime (3.4.7). */
export function suggestStaff(units: number): number {
  return Math.ceil(Math.max(0, units) / RULES.unitsPerEmployee.value);
}

export interface CompareRow {
  label: string;
  unit: string;
  values: number[];
  /** Difference to the first scenario; null for the first one. */
  deltas: (number | null)[];
  goodWhen: "higher" | "lower";
  /** true better, false worse, null for the reference and for unchanged values (D15: green/red only when it means something). */
  favorable: (boolean | null)[];
}

const COLUMNS: { label: string; unit: string; goodWhen: "higher" | "lower"; pick: (f: Forecast) => number }[] = [
  { label: "Units demanded", unit: "units", goodWhen: "higher", pick: (f) => f.demand },
  { label: "Units not delivered", unit: "units", goodWhen: "lower", pick: (f) => f.lostSales },
  { label: "Units left in stock", unit: "units", goodWhen: "lower", pick: (f) => f.closingUnits },
  { label: "Revenue", unit: "TEUR", goodWhen: "higher", pick: (f) => f.revenue },
  { label: "Operating income", unit: "TEUR", goodWhen: "higher", pick: (f) => f.operatingIncome },
  { label: "Net income", unit: "TEUR", goodWhen: "higher", pick: (f) => f.netIncome },
  { label: "Overdraft needed", unit: "TEUR", goodWhen: "lower", pick: (f) => f.overdraft },
  { label: "Errors", unit: "", goodWhen: "lower", pick: (f) => f.checks.filter((c) => c.level === "error").length },
  { label: "Warnings", unit: "", goodWhen: "lower", pick: (f) => f.checks.filter((c) => c.level === "warn").length },
];

export function compareScenarios(forecasts: Forecast[]): CompareRow[] {
  return COLUMNS.map((c) => {
    const values = forecasts.map(c.pick);
    const deltas = values.map((v, i) => (i === 0 ? null : v - values[0]));
    const favorable = deltas.map((d) => (d === null || Math.abs(d) < 0.005 ? null : c.goodWhen === "higher" ? d > 0 : d < 0));
    return { label: c.label, unit: c.unit, values, deltas, goodWhen: c.goodWhen, favorable };
  });
}
