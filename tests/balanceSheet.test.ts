import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseBalanceSheet } from "../src/parser/balanceSheet";

/** The TNB15 report as extracted from the P0 PDF (one page). */
const FULL_REPORT = readFileSync(
  resolve(import.meta.dirname, "../docs/p0_reports_sample.txt"),
  "utf8",
)
  .split("=== Report16_Balance Sheet.pdf")[1]
  .split("=== Report17_")[0];

describe("parseBalanceSheet", () => {
  it("reads the header: code, title, period, company", () => {
    const r = parseBalanceSheet(FULL_REPORT);
    expect(r.reportCode).toBe("TNB15");
    expect(r.title).toBe("Balance Sheet");
    expect(r.period).toBe(0);
    expect(r.company).toBe("Company 2");
  });

  it("reads the assets side: groups and items, current and previous period", () => {
    const { assets } = parseBalanceSheet(FULL_REPORT);
    expect(assets).toEqual([
      { label: "Fixed Assets", group: true, current: 3045, previous: 2325 },
      { label: "Property and Buildings", group: false, current: 420, previous: 450 },
      { label: "Machines and Production Facilities", group: false, current: 2625, previous: 1875 },
      { label: "Current Assets", group: true, current: 1304.91, previous: 1275 },
      { label: "Input Materials", group: false, current: 0, previous: 0 },
      { label: "Finished Products", group: false, current: 94.91, previous: 0 },
      { label: "Trade Receivables", group: false, current: 1200, previous: 1265 },
      { label: "Securities", group: false, current: 0, previous: 0 },
      { label: "Cash Balance", group: false, current: 10, previous: 10 },
    ]);
  });

  it("reads the liabilities side, rejoining labels the PDF wraps around the numbers", () => {
    // "Profit/Loss carried" / "0.00 0.00" / "forward" and "Long-term Loans gt" / "10 Periods" / "750.00 750.00".
    const { liabilities } = parseBalanceSheet(FULL_REPORT);
    expect(liabilities).toEqual([
      { label: "Equity", group: true, current: 2407.66, previous: 2200 },
      { label: "Share Capital", group: false, current: 700, previous: 700 },
      { label: "Capital Reserves", group: false, current: 1400, previous: 1400 },
      { label: "Retained Earnings", group: false, current: 100, previous: 100 },
      { label: "Profit/Loss carried forward", group: false, current: 0, previous: 0 },
      { label: "Net Income/Loss", group: false, current: 207.66, previous: 0 },
      { label: "Liabilities", group: true, current: 1942.25, previous: 1400 },
      { label: "Long-term Loans gt 10 Periods", group: false, current: 750, previous: 750 },
      { label: "Short-Term Loans lt 1 Period", group: false, current: 0, previous: 0 },
      { label: "Overdraft Loans", group: false, current: 1192.25, previous: 650 },
    ]);
  });

  it("reads the balance sheet totals for both sides", () => {
    expect(parseBalanceSheet(FULL_REPORT).total).toEqual({
      assets: { current: 4349.91, previous: 3600 },
      liabilities: { current: 4349.91, previous: 3600 },
    });
  });
});
