import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { extractPdfText } from "../src/import/pdfText";
import { previewPaste } from "../src/import/previewPaste";

// Henri's real "download all reports" ZIP for period 0 (Company 2), as TOPSIM serves it.
const ZIP = unzipSync(readFileSync(resolve(import.meta.dirname, "fixtures/p0-reports.zip")));
const SAMPLE = readFileSync(resolve(import.meta.dirname, "../docs/p0_reports_sample.txt"), "utf8");

/** The sample text the parsers were built on, for one "ReportN_<name>.pdf". */
function sampleFor(fileName: string): string {
  return SAMPLE.split(`=== ${fileName}\n`)[1].split(/^=== /m)[0];
}

/**
 * The pasted P&L text lists "Increase/Decrease of the Stock…" before "Other Income"; the PDF lists
 * them in printed order (Other Income is higher on the page). Same rows, same numbers — so compare
 * P&L rows regardless of order. Every other report must match line for line.
 */
function sortPnlRows<T>(preview: T): T {
  const p = structuredClone(preview) as { kind?: string; report?: { sections: { rows: { label: string }[] }[] } };
  if (p.kind !== "pnl") return preview;
  for (const s of p.report!.sections) s.rows.sort((a, b) => a.label.localeCompare(b.label));
  return p as T;
}

const individual = Object.keys(ZIP).filter((p) => p.includes("/Individual reports/"));

describe("extractPdfText", () => {
  it("finds all 16 individual reports in the fixture", () => {
    expect(individual).toHaveLength(16);
  });

  it.each(individual.map((p) => [p.split("/").pop()!, p]))(
    "%s parses to the same report as the pasted sample text",
    async (fileName, path) => {
      const text = await extractPdfText(ZIP[path]);
      const fromPdf = previewPaste(text);
      expect(fromPdf.status).toBe("ok");
      expect(sortPnlRows(fromPdf)).toEqual(sortPnlRows(previewPaste(sampleFor(fileName))));
    },
  );
});
