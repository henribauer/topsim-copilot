import type { PeriodFile } from "../store/periodStore";
import type { SectionedReport } from "../parser/sectionedReport";

/**
 * The dashboard's headline numbers (D13: KPI grid, three per row), read from the Executive Summary
 * (TNB01) of every saved period. Values stay exactly as TOPSIM printed them (`raw`); `n` is for charts.
 */
export interface Kpi {
  label: string;
  unit: string;
  /** false where a smaller number is the good direction (debt), so D8's green/red follows meaning, not sign. */
  higherIsBetter: boolean;
  points: { period: number; raw: string; n: number | null }[];
  /** Change from the previous saved period to the latest one; absent with fewer than two periods. */
  delta?: { abs: number; pct: number | null; favorable: boolean | null };
}

/** Where each KPI sits in TNB01: section heading + row label (some labels appear in two sections). */
const KPI_ROWS: { section: string; label: string; higherIsBetter: boolean }[] = [
  { section: "General", label: "Success Value Index", higherIsBetter: true },
  { section: "General", label: "Total Revenue", higherIsBetter: true },
  { section: "General", label: "Net Income/Net Loss", higherIsBetter: true },
  { section: "Superbass | Online-Market", label: "Market Share", higherIsBetter: true },
  { section: "Superbass | Online-Market", label: "Actual Sales", higherIsBetter: true },
  { section: "Performance Indicators", label: "Return on Sales", higherIsBetter: true },
  { section: "Performance Indicators", label: "Equity", higherIsBetter: true },
  { section: "Finance", label: "Final Cash Balance", higherIsBetter: true },
  { section: "Finance", label: "Overdraft Loans", higherIsBetter: false },
];

export function dashboardKpis(periods: PeriodFile[]): Kpi[] {
  const summaries = periods
    .filter((p) => p.reports.TNB01)
    .sort((a, b) => a.period - b.period)
    .map((p) => ({ period: p.period, report: p.reports.TNB01.parsed as unknown as SectionedReport }));

  return KPI_ROWS.map(({ section, label, higherIsBetter }) => {
    let unit = "";
    const points = summaries.flatMap(({ period, report }) => {
      const row = report.sections.find((s) => s.heading === section)?.rows.find((r) => r.label === label);
      if (!row) return [];
      unit = row.unit ?? unit;
      return [{ period, raw: row.values[0].raw, n: row.values[0].n }];
    });
    return { label, unit, higherIsBetter, points, ...deltaOf(points, higherIsBetter) };
  });
}

function deltaOf(points: Kpi["points"], higherIsBetter: boolean): Pick<Kpi, "delta"> {
  const [prev, last] = points.slice(-2);
  if (!last || prev.n === null || last.n === null) return {};
  // Round away float noise (6600 - 6000.00 parsed) to TOPSIM's two decimals.
  const abs = Math.round((last.n - prev.n) * 100) / 100;
  const pct = prev.n === 0 ? null : Math.round((abs / Math.abs(prev.n)) * 10000) / 100;
  const favorable = abs === 0 ? null : abs > 0 === higherIsBetter;
  return { delta: { abs, pct, favorable } };
}
