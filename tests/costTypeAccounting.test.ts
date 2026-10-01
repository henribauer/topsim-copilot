import { describe, it, expect } from "vitest";
import { parseCostTypeAccounting } from "../src/parser/costAccounting";
import { p0Report } from "./fixtures";

/** The TNB07 report as extracted from the P0 PDF (one page). */
const REPORT = p0Report("=== Report8_Cost Type Accounting.pdf", "=== Report9_");

describe("parseCostTypeAccounting", () => {
  it("reads the header, rejoining the title TOPSIM wraps around the period line", () => {
    const r = parseCostTypeAccounting(REPORT);
    expect(r.reportCode).toBe("TNB07");
    expect(r.title).toBe("Cost Type Accounting");
    expect(r.period).toBe(0);
    expect(r.company).toBe("Company 2");
  });

  it("reads the cost types per group, split into overhead and direct costs", () => {
    const { groups } = parseCostTypeAccounting(REPORT);
    expect(groups.map((g) => g.name)).toEqual(["Material Costs", "Staffing Costs", "Depreciation", "Other Costs"]);
    expect(groups[0].rows).toEqual([
      { label: "Input Materials/Parts", total: 1435, overhead: 0, direct: 1435 },
      { label: "Factory Materials", total: 123, overhead: 0, direct: 123 },
    ]);
    // "(*) with Overtime Costs" is a footnote on wages — kept as a note, not part of the label.
    expect(groups[1].rows[0]).toEqual({
      label: "Wages/Salaries", total: 1393, overhead: 573, direct: 820, note: "with Overtime Costs",
    });
    expect(groups[3].rows.map((r) => r.label)).toEqual([
      "Other Fixed Costs", "Storage Costs", "Advertising/CI", "Other Costs R&D", "Transport Costs",
    ]);
  });

  it("reads the total line separately from the cost types", () => {
    expect(parseCostTypeAccounting(REPORT).total).toEqual({ total: 5673.9, overhead: 1989.9, direct: 3684 });
  });
});
