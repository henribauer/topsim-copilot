import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { previewPaste, UNRECOGNISED_MESSAGE } from "../src/import/previewPaste";

const FULL_REPORT = readFileSync(
  resolve(import.meta.dirname, "../docs/p0_reports_sample.txt"),
  "utf8",
)
  .split("=== Report11_Contribution Margin.pdf")[1]
  .split("=== Report12_")[0];

const PNL_REPORT = readFileSync(
  resolve(import.meta.dirname, "../docs/p0_reports_sample.txt"),
  "utf8",
)
  .split("=== Report12_Profit and Loss Statement.pdf")[1]
  .split("=== Report13_")[0];

const BS_REPORT = readFileSync(
  resolve(import.meta.dirname, "../docs/p0_reports_sample.txt"),
  "utf8",
)
  .split("=== Report16_Balance Sheet.pdf")[1]
  .split("=== Report17_")[0];

describe("previewPaste", () => {
  it("returns 'empty' for blank input, so the screen shows the hint instead of an error", () => {
    expect(previewPaste("   \n  ")).toEqual({ status: "empty" });
  });

  it("returns 'ok' with the parsed report for a real TNB10 paste", () => {
    const result = previewPaste(FULL_REPORT);
    expect(result.status === "ok" && result.kind).toBe("cm");
    if (result.status !== "ok" || result.kind !== "cm") return;
    expect(result.report.period).toBe(0);
    expect(result.report.steps[0].values.at(-1)).toBe(6000);
    expect(result.report.perUnit?.unit).toBe("EUR");
  });

  it("recognises a TNB11 paste and returns it as kind 'pnl'", () => {
    const result = previewPaste(PNL_REPORT);
    expect(result.status === "ok" && result.kind).toBe("pnl");
    if (result.status !== "ok" || result.kind !== "pnl") return;
    expect(result.report.sections[2].rows.at(-1)?.value).toBe(207.66);
  });

  it("recognises a TNB15 paste and returns it as kind 'bs'", () => {
    const result = previewPaste(BS_REPORT);
    expect(result.status === "ok" && result.kind).toBe("bs");
    if (result.status !== "ok" || result.kind !== "bs") return;
    expect(result.report.total.assets.current).toBe(4349.91);
  });

  it("returns 'error' naming the supported reports when no known header is found", () => {
    expect(previewPaste("Balance Sheet\nAssets 1,000.00")).toEqual({
      status: "error",
      message: UNRECOGNISED_MESSAGE,
    });
    expect(UNRECOGNISED_MESSAGE).toContain("TNB10");
    expect(UNRECOGNISED_MESSAGE).toContain("TNB11");
    expect(UNRECOGNISED_MESSAGE).toContain("TNB15");
  });
});
