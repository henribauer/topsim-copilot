import { describe, expect, it } from "vitest";
import { forecast } from "../src/plan/forecast";
import { decisionsOf, openingAfter, type Decisions, type Opening } from "../src/plan/opening";
import { savedP0 } from "./fixtures";

/** Period 1 as Henri would plan it: opening = end of the real period 0, decisions = period 0's, then changed per test. */
const p0 = savedP0();
const opening = openingAfter(p0)!;
const same = decisionsOf(p0)!;
const plan = (change: Partial<Decisions> = {}, o: Opening = opening) => forecast(o, { ...same, newLines: 0, ...change });
const texts = (f: ReturnType<typeof plan>, level: string) => f.checks.filter((c) => c.level === level).map((c) => c.text);

describe("demand (3.1.3 price table, 3.1.4.1 advertising, 3.1.5 advisors)", () => {
  it("repeats last period's sales when nothing changes", () => {
    expect(plan().demand).toBe(40000);
  });
  it("follows the price table: EUR 140 sells 53,000, EUR 160 sells 28,500 units", () => {
    expect(plan({ price: 140, production: 53000, productionStaff: 27 }).demand).toBe(53000);
    expect(plan({ price: 160 }).demand).toBe(28500);
  });
  it("adds 4.5 % per extra advisor and takes it away for a missing one", () => {
    expect(plan({ advisors: 9 }).demand).toBe(41800);
    expect(plan({ advisors: 7 }).demand).toBe(38200);
  });
  it("adds 40 units per extra TEUR of advertising: +30 TEUR -> +1,200 units", () => {
    expect(plan({ advertising: 330 }).demand).toBe(41200);
    expect(plan({ advertising: 270 }).demand).toBe(38800);
  });
  it("never goes below zero, however little is advertised or however high the price", () => {
    expect(plan({ price: 400 }).demand).toBe(0);
    expect(plan({ price: 400, advertising: 0 }).demand).toBe(0); // 0 from the price table, minus 12,000 from advertising
    expect(plan({ advertising: 0 }).demand).toBe(28000); // 40,000 − 40 x 300
  });
  it("measures the change against last period's decisions, not against fixed numbers", () => {
    const later = { ...opening, price: 160, baseUnits: 28500 };
    expect(plan({ price: 160 }, later).demand).toBe(28500);
    expect(plan({ price: 150 }, later).demand).toBe(Math.round(28500 * (40000 / 28500)));
  });
  it("says it is an estimate, and warns outside the table or far from the advertising reference", () => {
    expect(plan({ price: 155 }).assumptions.join(" ")).toMatch(/price table/);
    expect(plan().assumptions.join(" ")).not.toMatch(/price table/);
    expect(texts(plan({ price: 170 }), "warn").join(" ")).toMatch(/EUR 140-160/);
    expect(texts(plan({ price: 150 }), "warn").join(" ")).not.toMatch(/EUR 140-160/);
    expect(texts(plan({ advertising: 450 }), "warn").join(" ")).toMatch(/advertising/);
    expect(texts(plan({ advertising: 380 }), "warn").join(" ")).not.toMatch(/advertising/);
  });
});

describe("stock, sales and storage", () => {
  it("sells from stock first: 1,000 in stock and 39,000 produced still serve 40,000", () => {
    const f = plan({ production: 39000 });
    expect(f.sold).toBe(40000);
    expect(f.closingUnits).toBe(0);
  });
  it("loses sales it cannot deliver, and says how many", () => {
    const f = plan({ production: 30000 });
    expect(f.sold).toBe(31000);
    expect(f.lostSales).toBe(9000);
    expect(texts(f, "warn").join(" ")).toContain("9,000 units of demand cannot be delivered");
  });
  it("charges EUR 5 storage per unit left at the end", () => {
    const f = plan({ production: 50000 }); // capped by staff? 23 x 2,000 x 1.2 = 55,200; lines 48,000 -> capped at 48,000
    expect(f.closingUnits).toBe(9000);
    expect(f.centers.sales).toBeCloseTo(304 + 0 + 91.2 + 6 + 100 + 45, 2);
  });
});

describe("stock valuation (3.3: stock is valued at manufacturing cost)", () => {
  it("values opening stock and new production at their weighted average cost, and says so", () => {
    const f = plan({ production: 42000, newLines: 0 }); // 1,000 + 42,000 available, 40,000 sold -> 3,000 left
    const avg = (f.costOfManufacture + 94.91) / 43000;
    expect(f.closingStockValue).toBeCloseTo(3000 * avg, 6);
    expect(f.costOfGoodsSold).toBeCloseTo(40000 * avg, 6);
    expect(f.closingStockValue).not.toBeCloseTo((3000 * f.costOfManufacture) / 42000, 3); // not "new production only"
    expect(f.assumptions.join(" ")).toMatch(/weighted average/);
  });
  it("shows no such assumption when there is no opening stock", () => {
    const f = plan({ production: 42000 }, { ...opening, finishedUnits: 0, finishedValue: 0 });
    expect(f.closingStockValue).toBeCloseTo((f.costOfManufacture / 42000) * 2000, 6);
    expect(f.assumptions.join(" ")).not.toMatch(/weighted average/);
  });
});

describe("limits of lines and staff (3.4.2, 3.4.7)", () => {
  it("cannot produce more than the lines allow: 48,000 with four lines, 60,000 with a fifth", () => {
    const f = plan({ production: 55000 });
    expect(f.produced).toBe(48000);
    expect(f.capacity).toBe(48000);
    expect(texts(f, "error").join(" ")).toContain("at most 48,000 units");
    const g = plan({ production: 55000, newLines: 1 });
    expect(g.capacity).toBe(60000);
    expect(g.produced).toBe(55000);
    expect(texts(g, "error")).toEqual([]);
  });
  it("cannot produce more than the staff allows even with 20 % overtime: 23 employees -> 55,200", () => {
    const f = plan({ production: 56000, newLines: 1, productionStaff: 23 });
    expect(f.produced).toBe(55200);
    expect(texts(f, "error").join(" ")).toContain("55,200");
  });
  it("uses overtime only above 2,000 units per employee, paid with a 25 % surcharge", () => {
    const none = plan({ production: 46000 });
    expect(texts(none, "info").join(" ")).not.toMatch(/overtime/);
    const ot = plan({ production: 47000, productionStaff: 23 });
    expect(texts(ot, "info").join(" ")).toContain("1,000 units need overtime");
    const extra = (47000 / 2000 - 23) * 40 * 1.25; // 0.5 staff x 40 TEUR x 1.25
    expect(ot.centers.production - none.centers.production).toBeGreaterThan(extra);
    expect(ot.personnel - none.personnel).toBeCloseTo(extra * 1.3 + 0, 2); // overtime wage + 30 % non-salary
  });
  it("requires at least one production line to remain", () => {
    expect(texts(plan({ scrapLines: [1, 2, 3, 4] }), "error").join(" ")).toContain("At least one production line");
    expect(texts(plan({ scrapLines: [1, 2, 3] }), "error").join(" ")).not.toContain("At least one");
  });
  it("blocks more than two quality levels per period", () => {
    expect(texts(plan({ qualityIncrease: 3 }), "error").join(" ")).toContain("two levels");
    expect(texts(plan({ qualityIncrease: 2 }), "error")).toEqual([]);
  });
});

describe("costs the replay of period 0 does not exercise", () => {
  const base = plan();
  it("depreciates a line only while it has running time left, and a new line from the first period", () => {
    // Opening lines: no. 1 is fully depreciated (0 periods left); 2, 3, 4 take 125 each.
    expect(base.depreciation).toBeCloseTo(3 * 125 + 30, 6);
    expect(plan({ newLines: 1 }).depreciation).toBeCloseTo(3 * 125 + 125 + 30, 6);
  });
  it("charges hires (15) and dismissals (10) per head at the cost center, and the 30 % non-salary rate on wages", () => {
    const hired = plan({ productionStaff: 25 });
    const cut = plan({ productionStaff: 21 });
    // base: 23 -> 23 employees, no change
    expect(hired.centers.production - base.centers.production).toBeCloseTo(2 * 40 * 1.3 + 2 * 15, 6);
    expect(cut.centers.production - base.centers.production).toBeCloseTo(-2 * 40 * 1.3 + 2 * 10, 6);
  });
  it("sizes purchasing and administration staff from revenue, and charges the change in headcount", () => {
    const f = plan({ price: 160, production: 28500 }); // 28,500 x 160 = 4.56 MEUR: between the graph points 4 -> 2.5 and 6 -> 3 (purchasing), 4 -> 1.5 and 6 -> 2 (admin)
    expect(f.revenue).toBeCloseTo(4560, 6);
    expect(f.workforceEnd.purchasing).toBeCloseTo(2.5 + (0.56 / 2) * 0.5, 6); // 2.64
    expect(f.workforceEnd.admin).toBeCloseTo(1.5 + (0.56 / 2) * 0.5, 6); // 1.64
    // purchasing falls from 3 to 2.64 heads: 0.36 dismissal x 10, wages 2.64 x 35, +30 %, buildings 3, other fixed 50
    expect(f.centers.purchasing).toBeCloseTo(2.64 * 35 * 1.3 + 0.36 * 10 + 3 + 50, 6);
  });
  it("lets a scrapped line pay out 25 % of its net book value, the rest is a loss", () => {
    const keep = plan({ production: 36000 });
    const sold = plan({ production: 36000, scrapLines: [2] }); // line 2: net book value 625, running time 5; both within the 36,000 the three remaining lines allow
    expect(sold.otherIncome).toBeCloseTo(156.25, 6);
    expect(sold.capacity).toBe(36000);
    // 125 less depreciation, 40 less fixed costs, 625 written off, 156.25 income
    expect(sold.operatingIncome - keep.operatingIncome).toBeCloseTo(125 + 40 - 625 + 156.25, 6);
    // the proceeds are a cash inflow of their own; the overdraft (also an inflow) shrinks by about as much, so compare without it
    expect(sold.cashIn - sold.overdraft - (keep.cashIn - keep.overdraft)).toBeCloseTo(156.25, 6);
    expect(sold.overdraft).toBeLessThan(keep.overdraft);
  });
  it("buys a line for 1,250 cash at once and depreciates it over ten periods", () => {
    const f = plan({ newLines: 1 });
    expect(f.cashOut - base.cashOut).toBeGreaterThan(1250); // interest on the extra overdraft comes on top
    expect(f.depreciation - base.depreciation).toBeCloseTo(125, 6);
  });
  it("adds 100 TEUR research cost per quality level and the level's variable cost per sold unit", () => {
    const f = plan({ qualityIncrease: 1 });
    // level 2: 18 EUR per sold unit instead of 16 -> +2 x 40,000 = 80 TEUR, plus 100 one-off
    expect(f.otherExpenses - base.otherExpenses).toBeCloseTo(80 + 100, 6);
    expect(texts(f, "info").join(" ")).toMatch(/quality/);
  });
  it("charges transport per unit sold at the rate the report showed, not per unit produced", () => {
    expect(plan({ price: 160 }).otherExpenses).toBeLessThan(base.otherExpenses);
  });
});

describe("result, tax and cash", () => {
  it("carries a loss forward and taxes later profit only after the loss is used up", () => {
    const loss = plan({ price: 140, advertising: 0 });
    // sales at 140 EUR with zero advertising: still check the bookkeeping identity
    expect(loss.netIncome).toBeCloseTo(loss.ebt - loss.tax, 9);
    const f = plan({}, { ...opening, lossCarryforward: 100 });
    const g = plan({});
    expect(f.tax).toBeCloseTo(Math.max(0, f.ebt - 100) * 0.35, 6); // overdraft interest depends on tax, so ebt differs slightly from g.ebt
    expect(f.tax).toBeLessThan(g.tax);
    expect(f.lossCarryforwardEnd).toBe(0);
    const bad = plan({ advertising: 2000 });
    expect(bad.ebt).toBeLessThan(0);
    expect(bad.tax).toBe(0);
    expect(bad.lossCarryforwardEnd).toBeCloseTo(-bad.ebt, 6);
    expect(texts(bad, "info").join(" ")).toContain("carried forward");
  });
  it("draws no overdraft when cash is plentiful, and keeps the surplus", () => {
    const rich = plan({}, { ...opening, cash: 5000 });
    expect(rich.overdraft).toBe(0);
    expect(rich.interestOverdraft).toBe(0);
    expect(rich.cashEnd).toBeGreaterThan(10);
    expect(texts(rich, "warn").join(" ")).not.toMatch(/overdraft/);
  });
  it("repays last period's overdraft out of this period's cash, and warns when a new one is drawn", () => {
    const f = plan();
    expect(f.cashOut).toBeGreaterThan(1192.25);
    expect(f.overdraft).toBeGreaterThan(0);
    expect(f.cashEnd).toBeCloseTo(10, 6);
    expect(texts(f, "warn").join(" ")).toMatch(/overdraft/);
  });
  it("holds the cash balance at the 10 TEUR minimum whenever it has to borrow", () => {
    for (const price of [140, 150, 160]) expect(plan({ price }).cashEnd).toBeCloseTo(10, 6);
  });
  it("takes 80 % of this period's revenue in cash now and 20 % next period", () => {
    const f = plan();
    expect(f.receivablesEnd).toBeCloseTo(f.revenue * 0.2, 9);
    // inflows: 80 % of revenue + last period's receivables (1,200) + the overdraft
    expect(f.cashIn).toBeCloseTo(f.revenue * 0.8 + 1200 + f.overdraft, 6);
  });
  it("admits when the overdraft interest rate is not known yet", () => {
    const noRate = plan({}, { ...opening, overdraftRate: 0 });
    expect(noRate.assumptions.join(" ")).toMatch(/overdraft interest rate/);
    expect(plan().assumptions.join(" ")).not.toMatch(/overdraft interest rate/);
  });
});
