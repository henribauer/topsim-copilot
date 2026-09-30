import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { previewPaste } from "../src/import/previewPaste";

const FULL_REPORT = readFileSync(
  resolve(import.meta.dirname, "../docs/p0_reports_sample.txt"),
  "utf8",
)
  .split("=== Report11_Contribution Margin.pdf")[1]
  .split("=== Report12_")[0];

describe("previewPaste", () => {
  it("returns 'empty' for blank input, so the screen shows the hint instead of an error", () => {
    expect(previewPaste("   \n  ")).toEqual({ status: "empty" });
  });

  it("returns 'ok' with the parsed report for a real TNB10 paste", () => {
    const result = previewPaste(FULL_REPORT);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.report.period).toBe(0);
    expect(result.report.steps[0].values.at(-1)).toBe(6000);
    expect(result.report.perUnit?.unit).toBe("EUR");
  });

  it("returns 'error' with a readable message when the text is not a TNB10 report", () => {
    expect(previewPaste("Balance Sheet\nAssets 1,000.00")).toEqual({
      status: "error",
      message: "Not a TNB10 Contribution Margin report: missing 'TNB10:' header",
    });
  });
});
