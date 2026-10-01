import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { zipSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { listZipReports } from "../src/import/reportsZip";

const P0_ZIP = new Uint8Array(readFileSync(resolve(import.meta.dirname, "fixtures/p0-reports.zip")));
const pdf = strToU8("%PDF-1.4 stub");

describe("listZipReports", () => {
  it("lists the 16 individual reports of TOPSIM's 'download all reports' ZIP, by report number", () => {
    const reports = listZipReports(P0_ZIP);
    expect(reports.map((r) => r.fileName)).toEqual([
      "Report1_Executive Summary.pdf", "Report2_Market Research Report.pdf", "Report3_Production Report.pdf",
      "Report5_Research & Development.pdf", "Report6_Inventory.pdf", "Report7_Human Resources.pdf",
      "Report8_Cost Type Accounting.pdf", "Report9_Cost Center Accounting.pdf", "Report10_Cost Unit Accounting.pdf",
      "Report11_Contribution Margin.pdf", "Report12_Profit and Loss Statement.pdf", "Report13_Cash Accounting.pdf",
      "Report15_Cash-Flow Statement.pdf", "Report16_Balance Sheet.pdf", "Report17_Business Report.pdf",
      "Report20_Decision Protocol.pdf",
    ]);
    expect(reports[0]).toMatchObject({ period: 0, company: "Company 2" });
    expect(reports[0].bytes.slice(0, 4)).toEqual(strToU8("%PDF"));
  });

  it("orders several periods oldest first and skips the collective report and stray files", () => {
    const zip = zipSync({
      "Period 1/Company 2/Individual reports/Report2_Market Research Report.pdf": pdf,
      "Period 1/Company 2/Individual reports/Report1_Executive Summary.pdf": pdf,
      "Period 1/Company 2/Collective report_Period 1_Company 2_.pdf": pdf,
      "Period 0/Company 2/Individual reports/Report1_Executive Summary.pdf": pdf,
      "__MACOSX/Period 0/._Report1_Executive Summary.pdf": pdf,
      "notes.txt": strToU8("hi"),
    });
    expect(listZipReports(zip).map((r) => `${r.period}/${r.fileName}`)).toEqual([
      "0/Report1_Executive Summary.pdf",
      "1/Report1_Executive Summary.pdf",
      "1/Report2_Market Research Report.pdf",
    ]);
  });

  it("explains when the ZIP is not a TOPSIM report download", () => {
    expect(() => listZipReports(zipSync({ "holiday.jpg": strToU8("x") }))).toThrow(
      "No TOPSIM reports in this ZIP (expected 'Period <n>/<company>/Individual reports/Report<n>_….pdf')",
    );
  });
});
