import { describe, it, expect } from "vitest";
import { parseSectionedReport } from "../src/parser/sectionedReport";
import { p0Report } from "./fixtures";

const v = (raw: string, n: number | null = Number(raw.replace(/,/g, ""))) => ({ raw, n });

describe("parseSectionedReport — TNB01 Executive Summary", () => {
  const REPORT = p0Report("=== Report1_Executive Summary.pdf", "=== ");

  it("reads the header and the rows of the first section with their unit", () => {
    const r = parseSectionedReport(REPORT);
    expect([r.reportCode, r.title, r.period, r.company]).toEqual(["TNB01", "Executive Summary", 0, "Company 2"]);
    expect(r.sections[0]).toEqual({
      heading: "General",
      columns: ["Period 0"],
      rows: [
        { label: "Success Value Index", values: [v("228.78")] },
        { label: "Total Revenue", unit: "TEUR", values: [v("6,000.00")] },
        { label: "Net Income/Net Loss", unit: "TEUR", values: [v("207.66")] },
      ],
    });
  });
});

describe("parseSectionedReport — TNB02 Market Research Report", () => {
  const REPORT = p0Report("=== Report2_Market Research Report.pdf", "=== ");

  it("reads named columns, pads a missing total cell and rejoins a label wrapped over two lines", () => {
    const r = parseSectionedReport(REPORT);
    expect(r.title).toBe("Market Research Report");
    const [s] = r.sections;
    expect(s.heading).toBe("Superbass - Online-Market");
    expect(s.columns).toEqual(["C1", "C2", "C3", "C4", "ø-Value / Total"]);
    expect(s.rows).toHaveLength(12);
    expect(s.rows[1]).toEqual({
      label: "Deviation Price", unit: "%", values: [v("0.00"), v("0.00"), v("0.00"), v("0.00"), v("", null)],
    });
    expect(s.rows[9]).toEqual({ label: "Not Covered Demand", unit: "Units", values: [v("0"), v("0"), v("0"), v("0"), v("", null)] });
  });
});
describe("parseSectionedReport — TNB12 Cash Accounting", () => {
  const REPORT = p0Report("=== Report13_Cash Accounting.pdf", "=== ");

  it("treats a lone unit line as the column header and keeps the totals inside their section", () => {
    const r = parseSectionedReport(REPORT);
    expect(r.title).toBe("Cash Accounting");
    expect(r.sections.map((s) => [s.heading, s.columns.join("|"), s.rows.length])).toEqual([
      ["", "TEUR", 1],
      ["Cash Inflows", "TEUR", 8],
      ["Cash Outflows", "TEUR", 11],
      ["", "TEUR", 1],
      ["Payment Conditions", "% in the Actual Period", 2],
    ]);
    expect(r.sections[2].rows[10]).toEqual({ label: "Total Cash Outflows", values: [v("7,257.25")] });
    expect(r.sections[4].rows[0]).toEqual({ label: "Customers Products (Cash Inflows)", values: [v("80.0")] });
  });
});
describe("parseSectionedReport — TNB14 Cash-Flow Statement", () => {
  const REPORT = p0Report("=== Report15_Cash-Flow Statement.pdf", "=== ");

  it("rejoins a title split at a hyphen and splits the +/- sign off the label", () => {
    const r = parseSectionedReport(REPORT);
    expect(r.title).toBe("Cash-Flow Statement");
    const [s] = r.sections;
    expect(s.columns).toEqual(["TEUR"]);
    expect(s.rows).toHaveLength(16);
    expect(s.rows[1]).toEqual({ sign: "+", label: "Depreciation on Fixed Assets", values: [v("530.00")] });
    expect(s.rows[4]).toEqual({ sign: "+", label: "Increase(-) / Reduction(+) Inventories of Finished Products", values: [v("-94.91")] });
    expect(s.rows[15]).toEqual({ label: "Free Cash-Flow (A+B)", values: [v("-542.25")] });
  });
});
describe("parseSectionedReport — TNB19 Decision Protocol", () => {
  const REPORT = p0Report("=== Report20_Decision Protocol.pdf", "=== ");

  it("reads every decision, including Yes/No answers, '+0' changes and a decision left empty", () => {
    const r = parseSectionedReport(REPORT);
    expect(r.title).toBe("Decision Protocol");
    expect(r.sections.map((s) => [s.heading, s.columns.join("|"), s.rows.length])).toEqual([
      ["Marketing Mix", "P 0", 4],
      ["Product Development", "P 0", 1],
      ["Bulk Buyer", "P 0", 1],
      ["Purchase and Production", "P 0", 1],
      ["Production Lines", "P 0", 2],
      ["Human Resources", "P 0", 1],
    ]);
    expect(r.sections[0].rows[3]).toEqual({ label: "Access Online-Market Superbass", values: [{ raw: "Yes", n: null }] });
    expect(r.sections[1].rows[0]).toEqual({ label: "Product Quality Level Superbass Increase", values: [v("+0", 0)] });
    expect(r.sections[4].rows[1]).toEqual({ label: "Disinvestment Line No.", values: [v("", null)] });
  });
});
describe("parseSectionedReport — TNB06 Human Resources", () => {
  const REPORT = p0Report("=== Report7_Human Resources.pdf", "=== ");

  it("rejoins labels wrapped over the unit line, keeps the footnote apart and ends the table at it", () => {
    const r = parseSectionedReport(REPORT);
    const cols = ["Purchasing", "Administration", "Production", "Account Manager", "Total"];
    expect(r.sections.map((s) => [s.heading, s.columns, s.rows.length])).toEqual([
      ["Workforce", cols, 5],
      ["Staffing Costs", cols, 4],
      ["", [], 1],
    ]);
    expect(r.sections[0].rows[4]).toEqual({
      sign: "=", label: "Final Workforce", unit: "Number", values: [v("3.0"), v("2.0"), v("23.0"), v("8.0"), v("36.0")],
    });
    expect(r.sections[1].rows.map((row) => row.label)).toEqual([
      "Wages/Salaries (*)", "Recruitment/Dismissals/Training", "Non-Salary Staff Costs (*)", "Total Staffing Costs",
    ]);
    expect(r.footnotes).toEqual(["(*) Without Overtime Costs"]);
    expect(r.sections[2].rows[0]).toEqual({ label: "Non-Salary Staff Costs in % of Salaries", values: [v("30.00")] });
  });
});
describe("parseSectionedReport — TNB05 Inventory", () => {
  const REPORT = p0Report("=== Report6_Inventory.pdf", "=== ");

  it("reads a column header printed over two lines and the + / - / = inventory movements", () => {
    const r = parseSectionedReport(REPORT);
    const cols = ["Quantity (Units)", "EUR/per unit", "Inventory (TEUR)"];
    expect(r.sections.map((s) => [s.heading, s.columns, s.rows.length])).toEqual([
      ["Overview Inventory · Superbass", [], 2],
      ["Input Materials/Parts Superbass", cols, 5],
      ["Finished Products Superbass", cols, 4],
      ["Storage Cost · All Products", [], 3],
    ]);
    expect(r.sections[2].rows[2]).toEqual({
      sign: "-", label: "Quantity Distributed", values: [v("40,000"), v("94.91"), v("3,796.59")],
    });
    expect(r.sections[3].rows[2]).toEqual({ label: "Total", unit: "TEUR", values: [v("5.00")] });
  });
});
describe("parseSectionedReport — TNB16 Business Report", () => {
  const REPORT = p0Report("=== Report17_Business Report.pdf", "=== ");

  it("reads all four companies and keeps numbers that are part of a label in the label", () => {
    const r = parseSectionedReport(REPORT);
    expect(r.title).toBe("Business Report of the Industry");
    const cols = ["C1", "C2", "C3", "C4"];
    expect(r.sections.map((s) => [s.heading, s.columns, s.rows.length])).toEqual([
      ["Cost of Sales Accounting (TEUR)", cols, 11],
      ["Balance Sheet (TEUR) · Assets", cols, 10],
      ["Liabilities", cols, 11],
    ]);
    const c = (raw: string) => [v(raw), v(raw), v(raw), v(raw)];
    expect(r.sections[1].rows[2]).toEqual({ label: "Machines and Production Facilities", values: c("2,625.00") });
    expect(r.sections[2].rows[7]).toEqual({ label: "Long-term Loans gt 10 Periods", values: c("750.00") });
    expect(r.sections[2].rows[8]).toEqual({ label: "Short-Term Loans lt 1 Period", values: c("0.00") });
  });
});
describe("parseSectionedReport — TNB04 Research & Development", () => {
  const REPORT = p0Report("=== Report5_Research & Development.pdf", "=== ");

  it("rejoins the title cut before the period and reads the column header printed over three lines", () => {
    const r = parseSectionedReport(REPORT);
    expect(r.title).toBe("Research & Development");
    expect(r.sections).toEqual([{
      heading: "Superbass",
      columns: ["Level Previous Period", "Level Current Period", "Fixed Costs (TEUR)", "Variable Cost (EUR/unit)", "Variable Costs (TEUR)"],
      rows: [{ label: "Product Quality", values: [v("1"), v("1"), v("0.00"), v("16.00"), v("640.00")] }],
    }]);
  });
});
describe("parseSectionedReport — TNB03 Production Report", () => {
  const REPORT = p0Report("=== Report3_Production Report.pdf", "=== ");

  it("reads all five tables across the page break", () => {
    const r = parseSectionedReport(REPORT);
    expect(r.sections.map((s) => [s.heading, s.columns.length, s.rows.length])).toEqual([
      ["Overview · Superbass", 0, 4],
      ["Production Lines", 7, 5],
      ["", 3, 5],
      ["Utilization Production Lines · Superbass", 0, 6],
      ["Utilization of Staff · Superbass", 0, 7],
    ]);
    expect(r.sections[3].rows[3]).toEqual({
      label: "Production Line Capacity Needed per Finished Product", unit: "Number per product", values: [v("1.00")],
    });
    expect(r.sections[4].rows[2]).toEqual({ label: "Production Capacity per Employee", unit: "Units/Period", values: [v("2,000")] });
  });

  it("keeps the line number in the label, even when it wraps below the values", () => {
    const [, lines, capacity] = parseSectionedReport(REPORT).sections;
    expect(lines.rows[0]).toEqual({
      label: "Type A Line Nr. 1", values: [v("-9"), v("1,250.00"), v("0"), v("125.00"), v("0.00"), v("200.00"), v("25.0")],
    });
    expect(capacity.rows[3]).toEqual({ label: "Type A Line Nr. 4", values: [v("12,000"), v("0.00"), v("1.00")] });
  });

  it("puts the values of the sparse Total row under the columns they belong to", () => {
    const [, lines] = parseSectionedReport(REPORT).sections;
    const empty = v("", null);
    expect(lines.columns[1]).toBe("Acquisition Value (TEUR)");
    expect(lines.rows[4]).toEqual({
      label: "Total", values: [empty, v("5,000.00"), empty, v("500.00"), v("2,625.00"), v("320.00"), empty],
    });
  });
});
