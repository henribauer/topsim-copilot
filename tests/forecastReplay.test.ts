import { describe, expect, it } from "vitest";
import { decisionsOf, openingBefore } from "../src/plan/opening";
import { forecast } from "../src/plan/forecast";
import { savedP0 } from "./fixtures";

describe("decisionsOf (Decision Protocol, TNB19)", () => {
  it("reads the decisions Henri typed into TOPSIM", () => {
    expect(decisionsOf(savedP0())).toEqual({
      price: 150,
      advertising: 300,
      advisors: 8,
      qualityIncrease: 0,
      production: 41000,
      newLines: 1,
      scrapLines: [],
      productionStaff: 23,
    });
  });
});

describe("openingBefore (the state period 0 started from)", () => {
  const o = openingBefore(savedP0())!;
  it("takes the starting workforce, stock, cash, receivables and debts from the reports' opening figures", () => {
    expect(o.period).toBe(0);
    expect(o.workforce).toEqual({ purchasing: 2, admin: 2, production: 20, sales: 6 });
    expect(o.finishedUnits).toBe(0);
    expect(o.cash).toBe(10);
    expect(o.receivables).toBe(1265);
    expect(o.loansToRepay).toBe(650);
    expect(o.longTermLoans).toBe(750);
  });
  it("has the three lines that existed before, with one more period of life left than at the end of the period, and not the line bought in it", () => {
    expect(o.lines.map((l) => [l.no, l.remainingTime, l.nbv])).toEqual([[1, 1, 125], [2, 6, 750], [3, 8, 1000]]);
  });
});

/**
 * THE check of the whole model: feed period 0's own opening state and decisions through the forecast and compare
 * with what TOPSIM reported. Revenue, every cost block, tax, overdraft and cash must come out to the cent. (The
 * interest rates and wages are read from the same period, so this proves the bookkeeping rules — the headcount
 * graphs, 30 % staff costs, depreciation, stock valuation, tax, the cash flow — not the demand rules.)
 */
describe("forecast replays period 0", () => {
  const p = savedP0();
  const f = forecast(openingBefore(p)!, decisionsOf(p)!);

  it("sells what the market demanded and produces what was decided", () => {
    expect(f.demand).toBe(40000);
    expect(f.sold).toBe(40000);
    expect(f.produced).toBe(41000);
    expect(f.closingUnits).toBe(1000);
    expect(f.lostSales).toBe(0);
  });

  it("reproduces the profit and loss statement (TNB11, by type of expense)", () => {
    expect(f.revenue).toBeCloseTo(6000, 2);
    expect(f.materialExpenses).toBeCloseTo(1558, 2);
    expect(f.personnel).toBeCloseTo(1900.9, 2);
    expect(f.depreciation).toBeCloseTo(530, 2);
    expect(f.otherExpenses).toBeCloseTo(1685, 2);
    expect(f.stockChange).toBeCloseTo(94.91, 2);
    expect(f.operatingIncome).toBeCloseTo(421.01, 2);
  });

  it("reproduces the cost of goods sold (TNB09) and the stock value", () => {
    expect(f.costOfManufacture).toBeCloseTo(3891.5, 2);
    expect(f.costOfGoodsSold).toBeCloseTo(3796.59, 2);
    expect(f.closingStockValue).toBeCloseTo(94.91, 2);
  });

  it("reproduces interest, tax and net income, with the overdraft solved the way TOPSIM draws it", () => {
    expect(f.overdraft).toBeCloseTo(1192.25, 1);
    expect(f.interestOverdraft).toBeCloseTo(71.54, 1);
    expect(f.interestLongTerm).toBeCloseTo(30, 2);
    expect(f.ebt).toBeCloseTo(319.48, 1);
    expect(f.tax).toBeCloseTo(111.82, 1);
    expect(f.netIncome).toBeCloseTo(207.66, 1);
  });

  it("reproduces the cash accounting (TNB12): inflows, outflows and the final cash balance", () => {
    expect(f.cashIn).toBeCloseTo(7257.25, 1);
    expect(f.cashOut).toBeCloseTo(7257.25, 1);
    expect(f.cashEnd).toBeCloseTo(10, 2);
    expect(f.receivablesEnd).toBeCloseTo(1200, 2);
  });

  it("finds nothing to warn about: period 0 was a feasible plan", () => {
    expect(f.checks.filter((c) => c.level === "error")).toEqual([]);
  });
});
