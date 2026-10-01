import { describe, expect, it } from "vitest";
import { forecast } from "../src/plan/forecast";
import { openingAfter } from "../src/plan/opening";
import { bestScenario, plannerSummary, sliderRange } from "../src/plan/summary";
import { defaultDecisions } from "../src/plan/scenarios";
import { savedP0 } from "./fixtures";

/**
 * Redesign step 4 (design guide R4). Mobbin refs docs/mobbin/planner.json: Claude calculator (outcome numbers above the
 * sliders), Quicken (inputs in labelled groups, one hero), Churnkey (one headline number tied to the slider),
 * Origin (compare scenarios as a secondary strip). The outcome stays in view while a decision changes.
 */
const p0 = savedP0();
const opening = openingAfter(p0)!;
const base = defaultDecisions(p0, opening);
const plan = (change = {}) => forecast(opening, { ...base, ...change });

describe("plannerSummary (the three numbers pinned above the form)", () => {
  it("gives net income, the overdraft the plan needs and how much of the possible production is used", () => {
    const f = plan();
    const s = plannerSummary(f, base);
    expect(s.netIncome).toBe(f.netIncome);
    expect(s.overdraft).toBe(f.overdraft);
    expect(s.limitUnits).toBe(48000); // four lines x 12,000; staff would allow 55,200
    expect(s.usedUnits).toBe(41000);
    expect(s.usedPct).toBeCloseTo(85.42, 2);
    expect(s.status).toBe("ok");
  });

  it("is limited by staff when staff, not lines, is the bottleneck", () => {
    const d = { ...base, productionStaff: 20 };
    const s = plannerSummary(forecast(opening, d), d);
    expect(s.limitUnits).toBe(48000); // 20 x 2,000 x 1.2 = 48,000, the same as the lines
    const d2 = { ...base, productionStaff: 15, production: 30000 };
    const s2 = plannerSummary(forecast(opening, d2), d2);
    expect(s2.limitUnits).toBe(36000);
    expect(s2.usedPct).toBeCloseTo(83.33, 2);
  });

  it("says 'tight' from 95 % and 'over' above the limit, and caps the bar at 100 %", () => {
    const tight = { ...base, production: 46000, productionStaff: 24 };
    expect(plannerSummary(forecast(opening, tight), tight).status).toBe("tight");
    const edge = { ...base, production: 45600, productionStaff: 24 };
    expect(plannerSummary(forecast(opening, edge), edge).status).toBe("tight"); // exactly 95 %
    const under = { ...base, production: 45500, productionStaff: 24 };
    expect(plannerSummary(forecast(opening, under), under).status).toBe("ok");
    const over = { ...base, production: 60000, productionStaff: 30 };
    const s = plannerSummary(forecast(opening, over), over);
    expect(s.status).toBe("over");
    expect(s.usedPct).toBe(125);
    expect(s.barPct).toBe(100);
  });

  it("producing exactly what the limit allows is tight, not over", () => {
    const d = { ...base, production: 48000, productionStaff: 40 };
    const s = plannerSummary(forecast(opening, d), d);
    expect(s.limitUnits).toBe(48000);
    expect(s.usedPct).toBe(100);
    expect(s.status).toBe("tight");
    const one = { ...d, production: 48001 };
    expect(plannerSummary(forecast(opening, one), one).status).toBe("over");
  });

  it("counts the problems TOPSIM would not accept", () => {
    const over = { ...base, production: 60000, productionStaff: 30 };
    expect(plannerSummary(forecast(opening, over), over).problems).toBe(1);
    expect(plannerSummary(plan(), base).problems).toBe(0);
  });

  it("does not divide by zero when there is no capacity left", () => {
    const d = { ...base, scrapLines: [1, 2, 3, 4], production: 0 };
    const s = plannerSummary(forecast(opening, d), d);
    expect(s.usedPct).toBe(0);
    expect(Number.isFinite(s.barPct)).toBe(true);
  });
});

describe("sliderRange (each decision gets a slider next to its number field)", () => {
  it("lets the price move 20 % either way around last period's price, in whole euros", () => {
    expect(sliderRange("price", opening, base)).toEqual({ min: 120, max: 180, step: 1, reference: 150 });
  });

  it("advertising: 0 to at least 600 TEUR in steps of 10, never narrower than twice last period's budget", () => {
    const r = sliderRange("advertising", opening, base);
    expect(r).toEqual({ min: 0, max: 600, step: 10, reference: 300 });
    expect(sliderRange("advertising", { ...opening, advertising: 500 }, base).max).toBe(1000);
  });

  it("advisors: 0 to at least 20, never below twice the current number", () => {
    expect(sliderRange("advisors", opening, base)).toEqual({ min: 0, max: 20, step: 1, reference: 8 });
    expect(sliderRange("advisors", { ...opening, advisors: 15 }, base).max).toBe(30);
  });

  it("quality: 0 to 2 levels, the manual's limit per period", () => {
    expect(sliderRange("qualityIncrease", opening, base)).toEqual({ min: 0, max: 2, step: 1, reference: 0 });
  });

  it("production: up to what the lines could make with three more lines, in steps of 500", () => {
    expect(sliderRange("production", opening, base)).toEqual({ min: 0, max: 84000, step: 500, reference: 41000 });
  });

  it("production staff: enough heads for that maximum without overtime", () => {
    expect(sliderRange("productionStaff", opening, base)).toEqual({ min: 0, max: 42, step: 1, reference: 23 });
  });

  it("new lines: 0 to 3", () => {
    expect(sliderRange("newLines", opening, base)).toEqual({ min: 0, max: 3, step: 1, reference: 0 });
  });

  it("keeps the current value reachable even when it lies outside the usual range", () => {
    const odd = { ...base, price: 200, advertising: 900 };
    expect(sliderRange("price", opening, base, odd).max).toBe(200);
    expect(sliderRange("advertising", opening, base, odd).max).toBe(900);
    expect(sliderRange("price", opening, base, odd).reference).toBe(150); // the tick stays where last period was
    expect(sliderRange("price", opening, base, { ...base, price: 130 }).max).toBe(180); // a value inside the range changes nothing
  });
});

describe("bestScenario (What-if: the column to highlight, D19)", () => {
  const good = plan();
  const better = plan({ advertising: 330 });
  const broken = plan({ production: 60000 }); // staff and lines cannot make it

  it("picks the plan with the highest net income", () => {
    expect(better.netIncome).not.toBeCloseTo(good.netIncome, 2);
    expect(bestScenario([good, better])).toBe(better.netIncome > good.netIncome ? 1 : 0);
    expect(bestScenario([better, good])).toBe(better.netIncome > good.netIncome ? 0 : 1);
  });

  it("ignores plans that TOPSIM would not accept", () => {
    expect(broken.checks.some((c) => c.level === "error")).toBe(true);
    const richBroken = { ...broken, netIncome: 1e9 };
    expect(bestScenario([good, richBroken])).toBe(0);
  });

  it("is null when only one plan exists (nothing to compare) or all plans are impossible", () => {
    expect(bestScenario([good])).toBeNull();
    expect(bestScenario([broken, broken])).toBeNull();
  });

  it("is null on a tie, so nothing is falsely called best", () => {
    expect(bestScenario([good, good])).toBeNull();
  });
});
