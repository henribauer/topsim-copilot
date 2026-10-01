import type { ContributionMarginReport, CmStep } from "../parser/contributionMargin";
import type { CostUnitReport } from "../parser/costAccounting";
import type { SectionedReport } from "../parser/sectionedReport";
import type { PeriodFile } from "../store/periodStore";

/**
 * The numbers behind the Analysis page (PRD Must 3). Everything is read from the saved reports, with Henri's
 * fixes already applied by the periods endpoint — nothing is estimated here, and each function says which
 * report it reads. Formulas follow the lecture script (p. 27–28: "mother of all formulas", contribution margin,
 * break-even point) so the page can show them with the real numbers filled in.
 */

const report = <T>(p: PeriodFile, code: string): T | null => (p.reports[code]?.parsed as unknown as T) ?? null;

/** Last value of a row: the "Total" / "ø-Value" column. Rows below CM IV carry only that one value. */
const total = (s: CmStep): number => s.values[s.values.length - 1];

export interface CascadeStep {
  label: string;
  kind: "revenue" | "cost" | "margin";
  /** TEUR, the Total column of TNB10 page 1. */
  total: number;
  /** EUR per unit sold, from page 2 of TNB10 (same row order); null if that page is missing. */
  perUnit: number | null;
}

export interface Cascade {
  unit: string;
  steps: CascadeStep[];
}

/** Contribution margin report (TNB10) as one list of steps: revenue, costs and CM I–V. */
export function cmCascade(p: PeriodFile): Cascade | null {
  const cm = report<ContributionMarginReport>(p, "TNB10");
  if (!cm) return null;
  const unitSteps = cm.perUnit?.steps.length === cm.steps.length ? cm.perUnit.steps : null;
  return {
    unit: cm.unit,
    steps: cm.steps.map((s, i) => ({
      label: s.label,
      kind: s.kind,
      total: total(s),
      perUnit: unitSteps ? total(unitSteps[i]) : null,
    })),
  };
}

export interface BreakEven {
  pricePerUnit: number;
  /** Revenue ÷ price. */
  unitsSold: number;
  /** Everything above CM I: direct material, direct production, transport (EUR per unit). */
  variableCostPerUnit: number;
  cmPerUnit: number;
  /** TEUR: all costs below CM I (fixed material and production, advertising, development, research, sales, administration). */
  fixedCosts: number;
  /** The cost blocks that add up to `fixedCosts`, in report order (for the worked example). */
  fixedParts: number[];
  breakEvenUnits: number;
  /** TEUR. */
  breakEvenRevenue: number;
  /** Units sold above the break-even point, and as % of units sold (margin of safety). */
  safetyUnits: number;
  safetyPct: number;
}

/**
 * Break-even point of the period (script p. 27: units × price = fixed costs + units × variable cost per unit
 * + profit, with profit = 0). In TOPSIM's multi-stage report the variable costs are the three blocks above
 * CM I; every cost block below it is fixed for this purpose. Null when the contribution margin per unit is
 * not positive — then no quantity ever covers the fixed costs.
 */
export function breakEven(p: PeriodFile): BreakEven | null {
  const c = cmCascade(p);
  const rev = c?.steps.find((s) => s.kind === "revenue");
  const cm1 = c?.steps.find((s) => s.label === "Contribution Margin I");
  if (!c || !rev || !cm1 || rev.perUnit === null || cm1.perUnit === null || rev.perUnit <= 0 || cm1.perUnit <= 0) return null;

  const cm1Index = c.steps.indexOf(cm1);
  const fixedParts = c.steps.slice(cm1Index + 1).filter((s) => s.kind === "cost").map((s) => s.total);
  const fixedCosts = round2(fixedParts.reduce((sum, v) => sum + v, 0));
  const unitsSold = Math.round((rev.total * 1000) / rev.perUnit);
  // Whole units: 34,927.47 units cannot be sold, so the point is reached with the next whole unit.
  const breakEvenUnits = Math.ceil((fixedCosts * 1000) / cm1.perUnit);
  const safetyUnits = unitsSold - breakEvenUnits;
  return {
    pricePerUnit: rev.perUnit,
    unitsSold,
    variableCostPerUnit: round2(rev.perUnit - cm1.perUnit),
    cmPerUnit: cm1.perUnit,
    fixedCosts,
    fixedParts,
    breakEvenUnits,
    breakEvenRevenue: round2((breakEvenUnits * rev.perUnit) / 1000),
    safetyUnits,
    safetyPct: round2((safetyUnits / unitsSold) * 100),
  };
}

export interface UnitCostStep {
  label: string;
  sign: "+" | "=" | "+/-";
  /** EUR per unit. */
  value: number;
}

/** Cost per unit sold (Cost Unit Accounting, TNB09, the per-unit table), in report order. */
export function costPerUnit(p: PeriodFile): UnitCostStep[] | null {
  const cu = report<CostUnitReport>(p, "TNB09");
  if (!cu) return null;
  return cu.perUnit.map((s) => ({ label: s.label, sign: s.sign, value: s.byProduct[0] }));
}

export interface ChangeRow {
  label: string;
  kind: CascadeStep["kind"];
  previous: number;
  latest: number;
  abs: number;
  /** null when the previous value is 0. */
  pct: number | null;
  /** null when nothing changed. Revenue and margins: more is good. Costs: less is good. */
  favorable: boolean | null;
}

export interface PeriodChange {
  previousPeriod: number;
  latestPeriod: number;
  rows: ChangeRow[];
}

/** Variance table (design guide D15): the latest period against the one before it, for every CM step. */
export function periodChange(periods: PeriodFile[]): PeriodChange | null {
  const withCm = periods
    .filter((p) => cmCascade(p))
    .sort((a, b) => a.period - b.period)
    .slice(-2);
  if (withCm.length < 2) return null;
  const [prev, last] = withCm.map((p) => cmCascade(p)!);
  const rows: ChangeRow[] = [];
  for (const s of last.steps) {
    const before = prev.steps.find((x) => x.label === s.label);
    if (!before) continue;
    const abs = round2(s.total - before.total);
    rows.push({
      label: s.label,
      kind: s.kind,
      previous: before.total,
      latest: s.total,
      abs,
      pct: before.total === 0 ? null : round2((abs / Math.abs(before.total)) * 100),
      favorable: abs === 0 ? null : s.kind === "cost" ? abs < 0 : abs > 0,
    });
  }
  return { previousPeriod: withCm[0].period, latestPeriod: withCm[1].period, rows };
}

export interface CompetitorRow {
  label: string;
  unit?: string;
  values: { raw: string; n: number | null }[];
}

export interface CompetitorTable {
  heading: string;
  /** "C1" … "C4", the companies in the simulation. */
  columns: string[];
  /** Index of our own company (the report header says "Company 2" → C2); -1 if it cannot be told. */
  ourColumn: number;
  rows: CompetitorRow[];
}

/** Market Research (TNB02), first section: how every company's online-market decisions and results compare. */
export function competitorTable(p: PeriodFile): CompetitorTable | null {
  const r = report<SectionedReport>(p, "TNB02");
  const section = r?.sections[0];
  if (!r || !section) return null;
  // The last column is an aggregate ("ø-Value / Total"), not a company.
  const columns = section.columns.filter((c) => /^C\d+$/.test(c));
  const ours = /(\d+)$/.exec(p.company)?.[1];
  return {
    heading: section.heading,
    columns,
    ourColumn: ours ? columns.indexOf(`C${ours}`) : -1,
    rows: section.rows.map((row) => ({ label: row.label, unit: row.unit, values: row.values.slice(0, columns.length) })),
  };
}

/** TOPSIM prints two decimals; rounding away float noise (199.51 + 1,037.07 …) keeps the numbers as printed. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
