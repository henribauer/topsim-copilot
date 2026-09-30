import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseProfitAndLoss } from "../src/parser/profitAndLoss";

/** The whole TNB11 report as extracted from the P0 PDF (pages 1 + 2). */
const FULL_REPORT = readFileSync(
  resolve(import.meta.dirname, "../docs/p0_reports_sample.txt"),
  "utf8",
)
  .split("=== Report12_Profit and Loss Statement.pdf")[1]
  .split("=== Report13_")[0];

describe("parseProfitAndLoss", () => {
  it("reads the wrapped header: code, title, period, company", () => {
    const r = parseProfitAndLoss(FULL_REPORT);
    expect(r.reportCode).toBe("TNB11");
    expect(r.title).toBe("Profit and Loss Statement");
    expect(r.period).toBe(0);
    expect(r.company).toBe("Company 2");
  });

  it("parses the Total Cost Accounting section: first and last row", () => {
    const section = parseProfitAndLoss(FULL_REPORT).sections[0];
    expect(section.title).toBe("Total Cost Accounting");
    expect(section.rows[0]).toEqual({
      sign: null, label: "Sales Revenue", value: 6000, percentOfRevenue: 100,
    });
    expect(section.rows.at(-1)).toEqual({
      sign: "=", label: "Operating Income", value: 421.01, percentOfRevenue: 7.02,
    });
  });

  it("untangles the stock-change row the PDF splits around 'Other Income'", () => {
    // PDF text order: "+ Increase/Decrease of the Stock of Finished" / "Products" /
    // "+ Other Income 0.00 0.00" / "94.91 1.58". 6000 + 94.91 + 0 − 1558 − 1900.90 − 530 − 1685 = 421.01.
    const rows = parseProfitAndLoss(FULL_REPORT).sections[0].rows;
    expect(rows.slice(1, 3)).toEqual([
      { sign: "+", label: "Increase/Decrease of the Stock of Finished Products", value: 94.91, percentOfRevenue: 1.58 },
      { sign: "+", label: "Other Income", value: 0, percentOfRevenue: 0 },
    ]);
    expect(rows.some((r) => r.label === "")).toBe(false);
  });

  it("reads all four sections, including the Appropriation block continued on page 2", () => {
    const { sections } = parseProfitAndLoss(FULL_REPORT);
    expect(sections.map((s) => [s.title, s.rows.length])).toEqual([
      ["Total Cost Accounting", 11],
      ["Cost of Sales Accounting", 7],
      ["Net Income/Net Loss", 8],
      ["Appropriation of Net Income", 3],
    ]);
    expect(sections[1].rows.at(-1)?.value).toBe(421.01); // both methods reach the same Operating Income
    expect(sections[2].rows.at(-1)).toEqual({
      sign: "=", label: "Net Income/Net Loss", value: 207.66, percentOfRevenue: 3.46,
    });
    expect(sections[3].rows[0]).toEqual({
      sign: null, label: "Income/Loss Carried Forward", value: 0, percentOfRevenue: null,
    });
    expect(sections[3].rows.at(-1)).toEqual({
      sign: "=", label: "Income/Loss Carried Forward", value: 207.66, percentOfRevenue: null,
    });
  });
});
