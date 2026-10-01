import { describe, it, expect } from "vitest";
import { parseCostUnitAccounting } from "../src/parser/costAccounting";
import { p0Report } from "./fixtures";

/** The TNB09 report as extracted from the P0 PDF (one page). */
const REPORT = p0Report("=== Report10_Cost Unit Accounting.pdf", "=== Report11_");

describe("parseCostUnitAccounting", () => {
  it("reads the header and the TEUR block: direct costs plus overhead per cost center, step by step", () => {
    const r = parseCostUnitAccounting(REPORT);
    expect([r.reportCode, r.title, r.period, r.company]).toEqual(["TNB09", "Cost Unit Accounting", 0, "Company 2"]);
    expect(r.products).toEqual(["Superbass"]);
    expect(r.totals.map((s) => [s.sign, s.label, s.total])).toEqual([
      ["+", "Purchasing Direct Costs", 1558],
      ["+", "Purchasing Overhead", 204.5],
      ["+", "Production Direct Costs", 1066],
      ["+", "Production Overhead", 1063],
      ["=", "Cost of Goods Manufactured", 3891.5],
      ["+/-", "Increase/Decrease in Finished Goods Inventory", -94.91],
      ["=", "Cost of Goods Sold", 3796.59],
      ["+", "R&D Direct Costs", 640],
      ["+", "R&D Overhead", 0],
      ["+", "Sales Direct Costs", 420],
      ["+", "Sales Overhead", 536.2],
      ["+", "Administration Direct Costs", 0],
      ["+", "Administration Overhead", 186.2],
      ["=", "Total Costs of Goods Sold", 5578.99],
    ]);
    expect(r.totals[0].byProduct).toEqual([1558]);
  });

  it("reads the per-unit block (EUR) and keeps the footnotes on the steps they belong to", () => {
    const { perUnit } = parseCostUnitAccounting(REPORT);
    expect(perUnit.map((s) => [s.sign, s.label, s.byProduct[0]])).toEqual([
      ["+", "Purchasing Direct Costs", 38],
      ["+", "Purchasing Overhead", 4.99],
      ["+", "Production Direct Costs", 26],
      ["+", "Production Overhead", 25.93],
      ["=", "Cost of Goods Manufactured", 94.91],
      ["=", "Cost of Goods Sold", 94.91],
      ["+", "R&D Direct Costs", 16],
      ["+", "R&D Overhead", 0],
      ["+", "Sales Direct Costs", 10.5],
      ["+", "Sales Overhead", 13.41],
      ["+", "Administration Direct Costs", 0],
      ["+", "Administration Overhead", 4.66],
      ["=", "Total Costs of Goods Sold", 139.47],
    ]);
    expect(perUnit[4].note).toBe("The Cost of Goods Manufactured is set in proportion to the quantity produced.");
    expect(perUnit[5].note).toBe("The Cost of Sales is set in proportion to the quantity sold.");
    expect(perUnit[12].note).toBe(perUnit[5].note);
    expect(perUnit[0].note).toBeUndefined();
  });
});
