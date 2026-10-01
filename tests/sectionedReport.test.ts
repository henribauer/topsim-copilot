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
