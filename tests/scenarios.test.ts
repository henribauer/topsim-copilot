import { describe, expect, it } from "vitest";
import { forecast } from "../src/plan/forecast";
import { openingAfter } from "../src/plan/opening";
import { compareScenarios, defaultDecisions, suggestStaff } from "../src/plan/scenarios";
import { savedP0 } from "./fixtures";

const p0 = savedP0();
const opening = openingAfter(p0)!;

describe("defaultDecisions (the plan to start from)", () => {
  it("repeats last period's marketing and production, with no new lines and nothing scrapped", () => {
    expect(defaultDecisions(p0, opening)).toEqual({
      price: 150, advertising: 300, advisors: 8, qualityIncrease: 0, production: 41000, newLines: 0, scrapLines: [], productionStaff: 23,
    });
  });
  it("falls back to the opening state when the decision protocol was not imported", () => {
    const p = savedP0();
    delete p.reports.TNB19;
    expect(defaultDecisions(p, opening)).toEqual({
      price: 150, advertising: 300, advisors: 8, qualityIncrease: 0, production: 40000, newLines: 0, scrapLines: [], productionStaff: 23,
    });
  });
});

describe("suggestStaff (3.4.7: 2,000 units per employee)", () => {
  it("rounds up to whole employees so the quantity needs no overtime", () => {
    expect(suggestStaff(41000)).toBe(21);
    expect(suggestStaff(40000)).toBe(20);
    expect(suggestStaff(0)).toBe(0);
  });
});

describe("compareScenarios (side by side, first one is the reference)", () => {
  const base = forecast(opening, defaultDecisions(p0, opening));
  const cheaper = forecast(opening, { ...defaultDecisions(p0, opening), price: 140, production: 48000, productionStaff: 24 });
  const rows = compareScenarios([base, cheaper]);
  const row = (label: string) => rows.find((r) => r.label === label)!;

  it("has one value per scenario and no change for the reference itself", () => {
    const r = row("Revenue");
    expect(r.values).toEqual([base.revenue, cheaper.revenue]);
    expect(r.deltas[0]).toBeNull();
    expect(r.deltas[1]).toBeCloseTo(cheaper.revenue - base.revenue, 9);
  });
  it("colours by what is good: more result is favourable, more overdraft is not", () => {
    expect(row("Operating income").goodWhen).toBe("higher");
    expect(row("Overdraft needed").goodWhen).toBe("lower");
    expect(row("Units not delivered").goodWhen).toBe("lower");
    const op = row("Operating income");
    expect(op.favorable[1]).toBe(cheaper.operatingIncome > base.operatingIncome);
    const od = row("Overdraft needed");
    expect(od.favorable[1]).toBe(cheaper.overdraft < base.overdraft);
  });
  it("marks an unchanged value as neither better nor worse", () => {
    const same = compareScenarios([base, base]);
    expect(same.find((r) => r.label === "Revenue")!.favorable[1]).toBeNull();
  });
  it("counts errors and warnings per scenario", () => {
    const over = forecast(opening, { ...defaultDecisions(p0, opening), production: 60000 });
    const r = compareScenarios([base, over]).find((x) => x.label === "Errors")!;
    expect(r.values).toEqual([0, 1]);
    expect(r.goodWhen).toBe("lower");
  });
});
