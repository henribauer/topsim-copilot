import type { PeriodFile } from "../store/periodStore";
import { RULES } from "../plan/constants";
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

/**
 * Redesign step 2 (design guide R1, Mobbin refs docs/mobbin/dashboard.json): one hero per page. The three headline
 * cards answer "how did we do?" (profit, revenue, market share), each carrying one supporting figure so the page
 * needs fewer cards; the financial-health numbers sit together below. Every KPI appears exactly once.
 */
export interface Headline {
  kpi: Kpi;
  /** One related figure shown small inside the same card; absent when the summary did not have it. */
  support?: Kpi;
}

export interface Layout {
  headline: Headline[];
  health: Kpi[];
}

const HEADLINE: [string, string][] = [
  ["Net Income/Net Loss", "Return on Sales"],
  ["Total Revenue", "Actual Sales"],
  ["Market Share", "Success Value Index"],
];
const HEALTH = ["Equity", "Final Cash Balance", "Overdraft Loans"];

export function dashboardLayout(kpis: Kpi[]): Layout {
  const by = new Map(kpis.map((k) => [k.label, k]));
  const has = (k: Kpi | undefined): k is Kpi => k !== undefined && k.points.length > 0;
  return {
    headline: HEADLINE.flatMap(([main, support]) => {
      const kpi = by.get(main);
      if (!has(kpi)) return [];
      const sup = by.get(support);
      return [{ kpi, ...(has(sup) ? { support: sup } : {}) }];
    }),
    health: HEALTH.map((l) => by.get(l)).filter(has),
  };
}

/** A note under the page title. Warnings come first; each names the handbook section it rests on. */
export interface Attention {
  id: "overdraft" | "cash" | "loss";
  level: "warn" | "info";
  text: string;
  source: string;
}

/**
 * What needs a look in the latest period: an overdraft (repaid from next period's cash), cash sitting on the minimum,
 * a loss. Numbers are printed as TOPSIM printed them.
 */
export function attentionItems(periods: PeriodFile[]): Attention[] {
  const kpis = dashboardKpis(periods);
  const last = (label: string) => kpis.find((k) => k.label === label)?.points.at(-1);
  const items: Attention[] = [];

  const overdraft = last("Overdraft Loans");
  if (overdraft?.n && overdraft.n > 0)
    items.push({
      id: "overdraft",
      level: "warn",
      text: `Overdraft of ${overdraft.raw} TEUR. It is repaid out of next period's cash, so plan the cash for it.`,
      source: "3.4.9.2",
    });

  const loss = last("Net Income/Net Loss");
  if (loss?.n !== undefined && loss.n !== null && loss.n < 0)
    items.push({
      id: "loss",
      level: "warn",
      text: `Net loss of ${loss.raw} TEUR. It is carried forward and reduces the tax on later profits.`,
      source: "3.5.3",
    });

  const cash = last("Final Cash Balance");
  if (cash?.n !== undefined && cash.n !== null && cash.n <= RULES.minCash.value)
    items.push({
      id: "cash",
      level: "info",
      text: `Cash is ${cash.raw} TEUR, the minimum TOPSIM keeps. Any shortfall is covered by a new overdraft.`,
      source: "3.4.9.2",
    });

  // Checked in this order on purpose: both warnings first, the cash note last (the test pins it).
  return items;
}
