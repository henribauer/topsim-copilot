import { describe, expect, it } from "vitest";
import { applyCorrections, type Correction } from "../src/store/corrections";

const pnl = {
  reportCode: "TNB11",
  sections: [{ title: "Total Cost Accounting", rows: [{ label: "Sales Revenue", value: 6000, percentOfRevenue: 100 }] }],
};
const fix = (path: Correction["path"], from: Correction["from"], to: string): Correction => ({
  path, from, to, at: "2026-10-01T10:00:00.000Z",
});

describe("applyCorrections", () => {
  it("replaces a misread number at its path and leaves the stored report untouched", () => {
    const { report, stale } = applyCorrections(pnl, [fix(["sections", 0, "rows", 0, "value"], 6000, "6,100.00")]);
    expect(report.sections[0].rows[0].value).toBe(6100);
    expect(stale).toEqual([]);
    expect(pnl.sections[0].rows[0].value).toBe(6000);
  });

  it("skips and reports a fix whose original value is no longer what the parser reads there", () => {
    const changed = fix(["sections", 0, "rows", 0, "value"], 5999, "6,100.00");
    const missing = fix(["sections", 0, "rows", 7, "value"], 12, "13.00");
    const { report, stale } = applyCorrections(pnl, [changed, missing]);
    expect(report.sections[0].rows[0].value).toBe(6000);
    expect(stale).toEqual([changed, missing]);
  });

  it("fixes a printed cell ({raw, n}) by its printed text, so the UI still shows TOPSIM's format", () => {
    const es = { sections: [{ rows: [{ label: "Market Share", values: [{ raw: "25.00", n: 25 }] }] }] };
    const path = ["sections", 0, "rows", 0, "values", 0];
    const { report, stale } = applyCorrections(es, [fix(path, "25.00", "2,500.00"), fix(path, "26.00", "1.00")]);
    expect(report.sections[0].rows[0].values[0]).toEqual({ raw: "2,500.00", n: 2500 });
    expect(stale.map((c) => c.to)).toEqual(["1.00"]);
  });
});
