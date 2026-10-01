import { describe, expect, it } from "vitest";
import { missingReports, openingAfter } from "../src/plan/opening";
import { savedP0 } from "./fixtures";

describe("openingAfter (the state period 1 starts from, read from period 0's reports)", () => {
  const o = openingAfter(savedP0())!;

  it("names the period being planned and the demand reference: last period's price, advertising, advisors and potential sales", () => {
    expect(o.period).toBe(1);
    expect(o.price).toBe(150);
    expect(o.advertising).toBe(300);
    expect(o.advisors).toBe(8);
    expect(o.qualityLevel).toBe(1);
    expect(o.baseUnits).toBe(40000);
  });

  it("takes headcount and wage per head from the Human Resources report", () => {
    expect(o.workforce).toEqual({ purchasing: 3, admin: 2, production: 23, sales: 8 });
    expect(o.wage).toEqual({ purchasing: 35, admin: 32, production: 40, sales: 38 });
  });

  it("lists the four production lines with their running time left, book value and fixed costs", () => {
    expect(o.lines).toEqual([
      { no: 1, acquired: -9, capacity: 12000, depreciation: 125, remainingTime: 0, nbv: 0, otherFixed: 200 },
      { no: 2, acquired: -4, capacity: 12000, depreciation: 125, remainingTime: 5, nbv: 625, otherFixed: 40 },
      { no: 3, acquired: -2, capacity: 12000, depreciation: 125, remainingTime: 7, nbv: 875, otherFixed: 40 },
      { no: 4, acquired: 0, capacity: 12000, depreciation: 125, remainingTime: 9, nbv: 1125, otherFixed: 40 },
    ]);
  });

  it("carries stock, receivables, cash and what must be repaid", () => {
    expect(o.finishedUnits).toBe(1000);
    expect(o.finishedValue).toBe(94.91);
    expect(o.receivables).toBe(1200);
    expect(o.cash).toBe(10);
    expect(o.loansToRepay).toBe(1192.25); // the overdraft is repaid automatically in the next period (3.4.9.2)
    expect(o.longTermLoans).toBe(750);
  });

  it("derives the interest rates and unit costs from period 0 instead of assuming them", () => {
    expect(o.longTermRate).toBeCloseTo(0.04, 6); // 30 ÷ 750
    expect(o.overdraftRate).toBeCloseTo(0.06, 4); // 71.54 ÷ 1,192.25
    expect(o.materialPerUnit).toBe(38); // purchasing direct costs per unit
  });

  it("splits the other fixed costs by cost center, with the production lines' own fixed costs taken out", () => {
    expect(o.otherFixed).toEqual({ purchasing: 50, production: 50, sales: 100, admin: 100 }); // production 370 − lines 320
  });

  it("has no loss to carry forward", () => {
    expect(o.lossCarryforward).toBe(0);
  });

  it("reads the building depreciation split and the transport cost per unit from the reports instead of assuming them", () => {
    expect(o.buildings).toEqual({ purchasing: 3, production: 18, sales: 6, admin: 3 });
    expect(o.transportPerUnit).toBe(3); // 120 TEUR ÷ 40,000 units
  });

  it("is null while a report it needs is missing, and missingReports says which", () => {
    const p = savedP0();
    expect(missingReports(p)).toEqual([]);
    delete p.reports.TNB03;
    delete p.reports.TNB15;
    expect(openingAfter(p)).toBeNull();
    expect(missingReports(p)).toEqual(["TNB03 Production Report", "TNB15 Balance Sheet"]);
  });
});
