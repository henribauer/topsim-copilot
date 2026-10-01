import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_STAFF, PRICE_SALES, PURCHASING_STAFF, RULES, requiredStaff, priceFactor, qualityVariableCost } from "../src/plan/constants";

const handbook = readFileSync(join(__dirname, "..", "docs", "handbook.txt"), "utf8");
/** The handbook breaks lines inside sentences, so compare with all whitespace collapsed. */
const flat = handbook.replace(/\s+/g, " ");

describe("RULES (every number comes from the TOPSIM manual — the quoted phrase must still be in docs/handbook.txt)", () => {
  it("quotes only text that exists in the handbook", () => {
    for (const [name, rule] of Object.entries(RULES)) {
      expect(flat, `${name}: ${rule.quote}`).toContain(rule.quote.replace(/\s+/g, " "));
    }
  });

  it("holds the values the manual states", () => {
    expect(RULES.taxRate.value).toBe(0.35);
    expect(RULES.minCash.value).toBe(10);
    expect(RULES.receiptsCurrentPeriod.value).toBe(0.8);
    expect(RULES.hireCost.value).toBe(15);
    expect(RULES.dismissCost.value).toBe(10);
    expect(RULES.nonSalaryRate.value).toBe(0.3);
    expect(RULES.unitsPerEmployee.value).toBe(2000);
    expect(RULES.maxOvertime.value).toBe(0.2);
    expect(RULES.overtimeSurcharge.value).toBe(0.25);
    expect(RULES.storageFinished.value).toBe(5);
    expect(RULES.lineCapacity.value).toBe(12000);
    expect(RULES.linePrice.value).toBe(1250);
    expect(RULES.lineLife.value).toBe(10);
    expect(RULES.lineOtherFixed.value).toBe(40);
    expect(RULES.lineResidual.value).toBe(0.25);
    expect(RULES.qualityResearch.value).toBe(100);
    expect(RULES.maxQualityStep.value).toBe(2);
    expect(RULES.advisorEffect.value).toBe(0.045);
    expect(RULES.advertisingUnitsPerTeur.value).toBe(40); // (330 − 300) TEUR → 1,200 units
  });
});

describe("price-sales table (3.1.3)", () => {
  it("is the manual's table", () => {
    expect(PRICE_SALES).toEqual([[140, 53000], [150, 40000], [160, 28500]]);
    expect(flat).toContain("€ 160 (+ 6.7%) Approx. 28,500 € 150 40,000 € 140 (- 6.7%) Approx. 53,000");
  });

  it("interpolates between the points and extrapolates the end slopes beyond them, never below zero", () => {
    expect(priceFactor(150)).toBe(40000);
    expect(priceFactor(155)).toBeCloseTo(34250, 6);
    expect(priceFactor(145)).toBeCloseTo(46500, 6);
    expect(priceFactor(170)).toBeCloseTo(28500 - 10 * 1150, 6); // slope of the 150–160 segment continues
    expect(priceFactor(130)).toBeCloseTo(53000 + 10 * 1300, 6);
    expect(priceFactor(400)).toBe(0);
  });
});

describe("required staff by revenue (3.4.5, the two graphs)", () => {
  it("matches the graph values printed in the manual", () => {
    expect(flat).toContain("2 2,5 3 3,5 4 4,5 5 6 7");
    expect(flat).toContain("1 1,5 2 3 4 5,5 7 9,5 12");
    expect(flat).toContain("2 4 6 8 10 12 14 18 22");
    expect(PURCHASING_STAFF).toEqual([[2, 2], [4, 2.5], [6, 3], [8, 3.5], [10, 4], [12, 4.5], [14, 5], [18, 6], [22, 7]]);
    expect(ADMIN_STAFF).toEqual([[2, 1], [4, 1.5], [6, 2], [8, 3], [10, 4], [12, 5.5], [14, 7], [18, 9.5], [22, 12]]);
  });

  it("gives period 0's headcount at its revenue of 6 MEUR, interpolates, and holds the end values outside the graph", () => {
    expect(requiredStaff(PURCHASING_STAFF, 6)).toBe(3);
    expect(requiredStaff(ADMIN_STAFF, 6)).toBe(2);
    expect(requiredStaff(PURCHASING_STAFF, 9)).toBe(3.75);
    expect(requiredStaff(ADMIN_STAFF, 16)).toBe(8.25);
    expect(requiredStaff(PURCHASING_STAFF, 1)).toBe(2);
    expect(requiredStaff(ADMIN_STAFF, 30)).toBe(12);
  });
});

describe("variable cost per unit by quality level (3.2)", () => {
  it("is 14 + 2 × level, as in the manual's table", () => {
    expect(flat).toContain("Level 1 2 3 4 5 6 7 8 9 10 11 12 13 Var. Costs [€] 16 18 20 22 24 26 28 30 32 34 36 38 40");
    expect(qualityVariableCost(1)).toBe(16);
    expect(qualityVariableCost(13)).toBe(40);
  });
});
