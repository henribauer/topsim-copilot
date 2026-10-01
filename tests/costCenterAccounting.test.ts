import { describe, it, expect } from "vitest";
import { parseCostCenterAccounting } from "../src/parser/costAccounting";
import { p0Report } from "./fixtures";

/** The TNB08 report as extracted from the P0 PDF (one page). */
const REPORT = p0Report("=== Report9_Cost Center Accounting.pdf", "=== ");

describe("parseCostCenterAccounting", () => {
  it("reads the header and the overhead of each cost type per cost center", () => {
    const r = parseCostCenterAccounting(REPORT);
    expect([r.reportCode, r.title, r.period, r.company]).toEqual(["TNB08", "Cost Center Accounting", 0, "Company 2"]);
    expect(r.centers).toEqual(["Purchasing", "Production", "R&D", "Sales", "Administration"]);
    // Labels wrap over up to three lines, numbers follow on their own line.
    expect(r.groups[1].rows).toEqual([
      { label: "Wages/Salaries", total: 573, byCenter: [105, 100, 0, 304, 64], note: "with Overtime Costs" },
      { label: "Recruitment/Dismissals/Training", total: 90, byCenter: [15, 45, 0, 30, 0] },
      { label: "Non-Salary Staff Costs", total: 171.9, byCenter: [31.5, 30, 0, 91.2, 19.2] },
    ]);
    expect(r.total).toEqual({ total: 1989.9, byCenter: [204.5, 1063, 0, 536.2, 186.2] });
  });
});
