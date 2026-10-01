import type { BalanceSheetReport } from "../parser/balanceSheet";
import type { CostCenterReport, CostUnitReport } from "../parser/costAccounting";
import type { ProfitAndLossReport } from "../parser/profitAndLoss";
import type { Row, SectionedReport } from "../parser/sectionedReport";
import type { PeriodFile } from "../store/periodStore";

/**
 * The state a period starts from, read from reports — everything the forecast needs and nothing it has to
 * guess. Wages, interest rates and unit costs are derived from the period's own numbers, so they stay right if
 * TOPSIM changes them. Money is TEUR unless a field says EUR.
 */
export interface Line {
  no: number;
  /** Period in which the line was bought (negative = before the game). */
  acquired: number;
  capacity: number;
  /** TEUR per period while `remainingTime` > 0. */
  depreciation: number;
  /** Periods of depreciation still to come at the start of the period. */
  remainingTime: number;
  nbv: number;
  /** TEUR per period, whether or not the line is used. */
  otherFixed: number;
}

export interface Staff {
  purchasing: number;
  admin: number;
  production: number;
  sales: number;
}

export interface Opening {
  /** The period being planned. */
  period: number;
  company: string;
  /** Demand reference: what the reference period decided and sold. */
  price: number;
  advertising: number;
  advisors: number;
  qualityLevel: number;
  baseUnits: number;
  workforce: Staff;
  /** TEUR per head per period (salary without non-salary costs). */
  wage: Staff;
  lines: Line[];
  finishedUnits: number;
  finishedValue: number;
  receivables: number;
  cash: number;
  /** Overdraft and short-term loans from last period: repaid automatically now. */
  loansToRepay: number;
  longTermLoans: number;
  longTermRate: number;
  overdraftRate: number;
  /** Cumulative loss that still reduces taxable profit (3.5.3), TEUR. */
  lossCarryforward: number;
  /** EUR per unit produced: input material plus operating materials. */
  materialPerUnit: number;
  /** TEUR per period, besides the lines' own fixed costs. */
  otherFixed: Staff;
  /** TEUR per period of building depreciation, as the cost center report splits it. */
  buildings: Staff;
  /** EUR per unit sold (delivery from the online store, 3.1.5). */
  transportPerUnit: number;
}

/** What Henri types into TOPSIM (Decision Protocol, TNB19). */
export interface Decisions {
  price: number;
  advertising: number;
  /** Customer advisors at the end of the period ("Account Manager Final Workforce"). */
  advisors: number;
  qualityIncrease: number;
  production: number;
  newLines: number;
  /** Line numbers to scrap. */
  scrapLines: number[];
  productionStaff: number;
}

/** The reports the readers need, with the names to show Henri when one is missing. */
const NEEDED: [string, string][] = [
  ["TNB02", "Market Research Report"],
  ["TNB03", "Production Report"],
  ["TNB05", "Inventory"],
  ["TNB06", "Human Resources"],
  ["TNB08", "Cost Center Accounting"],
  ["TNB09", "Cost Unit Accounting"],
  ["TNB11", "Profit and Loss Statement"],
  ["TNB12", "Cash Accounting"],
  ["TNB15", "Balance Sheet"],
];

export function missingReports(p: PeriodFile): string[] {
  return NEEDED.filter(([code]) => !p.reports[code]).map(([code, name]) => `${code} ${name}`);
}

const get = <T>(p: PeriodFile, code: string): T => p.reports[code].parsed as unknown as T;
const n = (row: Row | undefined, i = 0): number => row?.values[i]?.n ?? NaN;
const round2 = (x: number): number => Math.round(x * 100) / 100;

function findRow(r: SectionedReport, label: string, heading?: string): Row {
  for (const s of r.sections) {
    if (heading !== undefined && s.heading !== heading) continue;
    const row = s.rows.find((x) => x.label === label);
    if (row) return row;
  }
  throw new Error(`Row "${label}" not found in ${r.reportCode}`);
}

/** Everything both readers share: the period's own figures at the END of the period. */
function readEnd(p: PeriodFile) {
  // Market research: our column of the first section holds the period's decisions and potential sales.
  const market = get<SectionedReport>(p, "TNB02");
  const colNo = /(\d+)$/.exec(p.company)?.[1];
  const col = market.sections[0].columns.indexOf(`C${colNo}`);
  if (col < 0) return null;
  const at = (label: string) => n(findRow(market, label, market.sections[0].heading), col);

  // Human resources: headcount and wages per cost center.
  const hr = get<SectionedReport>(p, "TNB06");
  const hrCols = hr.sections.find((s) => s.heading === "Workforce")!.columns; // Purchasing, Administration, Production, Account Manager, Total
  const idx = (name: string) => hrCols.indexOf(name);
  const row = (label: string, heading: string) => findRow(hr, label, heading);
  const staffOf = (label: string): Staff => ({
    purchasing: n(row(label, "Workforce"), idx("Purchasing")),
    admin: n(row(label, "Workforce"), idx("Administration")),
    production: n(row(label, "Workforce"), idx("Production")),
    sales: n(row(label, "Workforce"), idx("Account Manager")),
  });
  const finalStaff = staffOf("Final Workforce");
  const wages = row("Wages/Salaries (*)", "Staffing Costs");
  const wageOf = (name: string, heads: number) => round2(n(wages, idx(name)) / heads);

  // Production report: one row per line in two tables (financial, then capacity).
  const prod = get<SectionedReport>(p, "TNB03");
  const finTable = prod.sections.find((s) => s.heading === "Production Lines")!;
  const capTable = prod.sections.find((s) => s.columns[0]?.startsWith("Normal Capacity"))!;
  const lines: Line[] = finTable.rows
    .filter((r) => /^Type A Line Nr\. \d+$/.test(r.label))
    .map((r) => {
      const no = Number(/(\d+)$/.exec(r.label)![1]);
      const cap = capTable.rows.find((c) => c.label === r.label)!;
      // values: acquisition period, acquisition value, remaining residual time, depreciation, net book value, other fixed costs, residual %
      return { no, acquired: n(r, 0), capacity: n(cap, 0), depreciation: n(r, 3), remainingTime: n(r, 2), nbv: n(r, 4), otherFixed: n(r, 5) };
    });

  const bs = get<BalanceSheetReport>(p, "TNB15");
  const pnl = get<ProfitAndLossReport>(p, "TNB11").sections.flatMap((s) => s.rows);
  const pnlValue = (label: string) => pnl.find((r) => r.label === label)!.value;
  const liab = (prefix: string, side: "current" | "previous") => bs.liabilities.find((r) => r.label.startsWith(prefix))?.[side] ?? 0;
  const longTerm = liab("Long-term Loans", "current");
  const overdraft = liab("Overdraft", "current");

  const cc = get<CostCenterReport>(p, "TNB08");
  const fixedRow = cc.groups.flatMap((g) => g.rows).find((r) => r.label === "Other Fixed Costs")!;
  const center = (name: string) => fixedRow.byCenter[cc.centers.indexOf(name)];
  const linesFixed = lines.reduce((sum, l) => sum + l.otherFixed, 0);

  const unit = get<CostUnitReport>(p, "TNB09");
  const buildingsRow = cc.groups.flatMap((g) => g.rows).find((r) => r.label === "Buildings")!;
  const building = (name: string) => buildingsRow.byCenter[cc.centers.indexOf(name)];
  // Units sold are not printed as such; revenue ÷ price is exact (TOPSIM prints both).
  const transport = get<CostCenterReport>(p, "TNB07").groups.flatMap((g) => g.rows).find((r) => r.label === "Transport Costs")!.total;
  const revenue = pnl.find((r) => r.label === "Sales Revenue")!.value;
  const carried = bs.liabilities.find((r) => r.label.startsWith("Profit/Loss carried forward"))?.current ?? 0;
  const netIncome = bs.liabilities.find((r) => r.label.startsWith("Net Income/Loss"))?.current ?? 0;
  const cash = get<SectionedReport>(p, "TNB12");

  return {
    market: {
      price: at("Price"),
      advertising: at("Advertising"),
      advisors: at("Account Manager"),
      qualityLevel: at("Product Quality Level"),
      baseUnits: at("Potential Sales"),
    },
    initialStaff: staffOf("Initial Workforce"),
    finalStaff,
    wage: {
      purchasing: wageOf("Purchasing", finalStaff.purchasing),
      admin: wageOf("Administration", finalStaff.admin),
      production: wageOf("Production", finalStaff.production),
      sales: wageOf("Account Manager", finalStaff.sales),
    },
    lines,
    inventory: get<SectionedReport>(p, "TNB05").sections.find((s) => s.heading === "Finished Products Superbass")!.rows,
    bs,
    receivablesEnd: bs.assets.find((r) => r.label === "Trade Receivables")!.current,
    overdraftEnd: overdraft,
    shortTermEnd: liab("Short-Term Loans", "current"),
    longTermEnd: longTerm,
    overdraftBefore: liab("Overdraft", "previous"),
    shortTermBefore: liab("Short-Term Loans", "previous"),
    longTermBefore: liab("Long-term Loans", "previous"),
    longTermRate: longTerm > 0 ? Math.round((pnlValue("Interests for Short- and Long-term Loans") / longTerm) * 1000) / 1000 : 0,
    overdraftRate: overdraft > 0 ? Math.round((pnlValue("Interests for Overdraft Loan") / overdraft) * 1000) / 1000 : 0,
    lossCarryforward: Math.max(0, -(carried + netIncome)),
    materialPerUnit: unit.perUnit.find((s) => s.label === "Purchasing Direct Costs")!.byProduct[0],
    otherFixed: {
      purchasing: center("Purchasing"),
      production: round2(center("Production") - linesFixed),
      sales: center("Sales"),
      admin: center("Administration"),
    },
    buildings: { purchasing: building("Purchasing"), admin: building("Administration"), production: building("Production"), sales: building("Sales") },
    transportPerUnit: round2((transport * 1000) / ((revenue * 1000) / at("Price"))),
    finalCash: n(findRow(cash, "Final Cash Balance")),
    initialCash: n(findRow(cash, "Initial Cash Balance")),
  };
}

/** The state period `p.period + 1` starts from. */
export function openingAfter(p: PeriodFile): Opening | null {
  if (missingReports(p).length > 0) return null;
  const e = readEnd(p);
  if (!e) return null;
  const stock = e.inventory.find((r) => r.label === "Final Inventory")!;
  return {
    period: p.period + 1,
    company: p.company,
    ...e.market,
    workforce: e.finalStaff,
    wage: e.wage,
    lines: e.lines,
    finishedUnits: n(stock, 0),
    finishedValue: n(stock, 2),
    receivables: e.receivablesEnd,
    cash: e.finalCash,
    // The overdraft is repaid automatically in the next period (3.4.9.2), short-term loans after one period (3.5.2.1).
    loansToRepay: e.overdraftEnd + e.shortTermEnd,
    longTermLoans: e.longTermEnd,
    longTermRate: e.longTermRate,
    overdraftRate: e.overdraftRate,
    lossCarryforward: e.lossCarryforward,
    materialPerUnit: e.materialPerUnit,
    otherFixed: e.otherFixed,
    buildings: e.buildings,
    transportPerUnit: e.transportPerUnit,
  };
}

/**
 * The state period `p.period` itself started from, rebuilt from its reports' opening figures. The demand reference is
 * the period's own market data, so the forecast of the period's own decisions asks the market for exactly what it
 * sold. This is what lets the model be checked against a real period (see tests/forecastReplay.test.ts).
 */
export function openingBefore(p: PeriodFile): Opening | null {
  if (missingReports(p).length > 0) return null;
  const e = readEnd(p);
  if (!e) return null;
  const stock = e.inventory.find((r) => r.label === "Initial Inventory")!;
  return {
    period: p.period,
    company: p.company,
    ...e.market,
    workforce: e.initialStaff,
    wage: e.wage,
    // Lines bought in this period did not exist yet. The others had one more period of depreciation ahead of them,
    // and a book value higher by this period's depreciation.
    lines: e.lines
      .filter((l) => l.acquired < p.period)
      .map((l) => ({
        ...l,
        remainingTime: l.remainingTime + (l.depreciation > 0 ? 1 : 0),
        nbv: round2(l.nbv + l.depreciation),
      })),
    finishedUnits: n(stock, 0),
    finishedValue: n(stock, 2),
    receivables: e.bs.assets.find((r) => r.label === "Trade Receivables")!.previous,
    cash: e.initialCash,
    loansToRepay: e.overdraftBefore + e.shortTermBefore,
    longTermLoans: e.longTermBefore,
    longTermRate: e.longTermRate,
    overdraftRate: e.overdraftRate,
    lossCarryforward: 0,
    materialPerUnit: e.materialPerUnit,
    otherFixed: e.otherFixed,
    buildings: e.buildings,
    transportPerUnit: e.transportPerUnit,
  };
}

/** Reads the Decision Protocol (TNB19) of a period; null if that report was not imported. */
export function decisionsOf(p: PeriodFile): Decisions | null {
  const r = p.reports.TNB19?.parsed as unknown as SectionedReport | undefined;
  if (!r) return null;
  const rows = r.sections.flatMap((s) => s.rows);
  const raw = (prefix: string) => rows.find((x) => x.label.startsWith(prefix))?.values[0]?.raw ?? "";
  const num = (prefix: string) => Number(raw(prefix).replace(/[,+\s]/g, "")) || 0;
  return {
    price: num("Price"),
    advertising: num("Advertising"),
    advisors: num("Account Manager"),
    qualityIncrease: num("Product Quality Level"),
    production: num("Production Volume"),
    newLines: num("Investment"),
    scrapLines: raw("Disinvestment")
      .split(/[,;\s]+/)
      .filter(Boolean)
      .map(Number)
      .filter(Number.isFinite),
    productionStaff: num("Production Staff"),
  };
}
