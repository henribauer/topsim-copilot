import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseContributionMargin } from "../src/parser/contributionMargin";

const REAL_SAMPLE = readFileSync(
  resolve(import.meta.dirname, "../docs/p0_reports_sample.txt"),
  "utf8",
)
  .split("=== Report11_Contribution Margin.pdf")[1]
  .split("Superbass - Contribution Margin Accounting per Unit")[0];

const SAMPLE = `=== Report11_Contribution Margin.pdf
TNB10: Contribution Margin Period: 0
Management Essentials Management Essentials - Company 2
Superbass - Contribution Margin Total (TEUR)
Online-Market Bulk Buyer Requests for Bids Retail Market Special Market Total
Sales Revenue 6,000.00 0.00 0.00 0.00 0.00 6,000.00
- Direct Material
Costs
1,520.00 0.00 0.00 0.00 0.00 1,520.00
- Page 1 Copyright (c) by Topsim GmbH
`;

describe("parseContributionMargin — header", () => {
  it("extracts report code, period, company and unit", () => {
    const report = parseContributionMargin(SAMPLE);
    expect(report.reportCode).toBe("TNB10");
    expect(report.period).toBe(0);
    expect(report.company).toBe("Company 2");
    expect(report.unit).toBe("TEUR");
  });

  it("extracts the channel columns", () => {
    const report = parseContributionMargin(SAMPLE);
    expect(report.channels).toEqual([
      "Online-Market",
      "Bulk Buyer",
      "Requests for Bids",
      "Retail Market",
      "Special Market",
      "Total",
    ]);
  });

  it("parses a single-line row into a revenue step", () => {
    const report = parseContributionMargin(SAMPLE);
    expect(report.steps[0]).toEqual({
      kind: "revenue",
      label: "Sales Revenue",
      values: [6000, 0, 0, 0, 0, 6000],
    });
  });

  it("reassembles a label wrapped across lines", () => {
    const report = parseContributionMargin(SAMPLE);
    expect(report.steps[1]).toEqual({
      kind: "cost",
      label: "Direct Material Costs",
      values: [1520, 0, 0, 0, 0, 1520],
    });
  });
});

describe("parseContributionMargin — real Period 0 report", () => {
  it("parses all 16 steps of the Total (TEUR) table", () => {
    const report = parseContributionMargin(REAL_SAMPLE);
    expect(report.steps.map((s) => `${s.kind}:${s.label}`)).toEqual([
      "revenue:Sales Revenue",
      "cost:Direct Material Costs",
      "cost:Direct Production Costs",
      "cost:Transport Costs",
      "margin:Contribution Margin I",
      "cost:Fixed Material Costs",
      "cost:Fixed Production Costs",
      "margin:Contribution Margin II",
      "cost:Advertising Costs",
      "margin:Contribution Margin III",
      "cost:Development Costs",
      "margin:Contribution Margin IV",
      "cost:Research Costs",
      "cost:Sales Costs",
      "cost:Administration Costs",
      "margin:Contribution Margin V",
    ]);
  });

  it("reads Margin I in full and Margin V as Total-only", () => {
    const report = parseContributionMargin(REAL_SAMPLE);
    const marginI = report.steps.find((s) => s.label === "Contribution Margin I")!;
    expect(marginI.values).toEqual([3320, 0, 0, 0, 0, 3320]);
    const marginV = report.steps.find((s) => s.label === "Contribution Margin V")!;
    expect(marginV.values).toEqual([421.01]);
  });
});
