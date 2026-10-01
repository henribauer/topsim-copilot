import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { importFiles, orderReports, type ImportItem } from "../src/import/importFiles";

const ZIP_BYTES = new Uint8Array(readFileSync(resolve(import.meta.dirname, "fixtures/p0-reports.zip")));
const ENTRIES = unzipSync(ZIP_BYTES);
const pdfOf = (name: string) =>
  ENTRIES[Object.keys(ENTRIES).find((p) => p.endsWith(`/Individual reports/${name}`))!];

describe("importFiles", () => {
  it("turns the 'download all reports' ZIP into 16 parsed reports, in report order", async () => {
    const { items, skipped } = await importFiles([{ name: "reports.zip", bytes: ZIP_BYTES }]);
    expect(items).toHaveLength(16);
    expect(items.every((i) => i.preview.status === "ok")).toBe(true);
    expect(items.map((i) => i.code)).toEqual([
      "TNB01", "TNB02", "TNB03", "TNB04", "TNB05", "TNB06", "TNB07", "TNB08",
      "TNB09", "TNB10", "TNB11", "TNB12", "TNB14", "TNB15", "TNB16", "TNB19",
    ]);
    expect(items[0]).toMatchObject({ source: "reports.zip › Report1_Executive Summary.pdf", period: 0 });
    expect(skipped).toEqual([]);
  });

  it("orders loose PDFs by period, then report, and skips a report dropped twice", async () => {
    const bs = pdfOf("Report16_Balance Sheet.pdf");
    const es = pdfOf("Report1_Executive Summary.pdf");
    const { items, skipped } = await importFiles([
      { name: "Report16_Balance Sheet.pdf", bytes: bs },
      { name: "Report1_Executive Summary.pdf", bytes: es },
      { name: "copy of Report1.pdf", bytes: es },
    ]);
    expect(items.map((i) => i.code)).toEqual(["TNB01", "TNB15"]);
    expect(skipped).toEqual(["copy of Report1.pdf: same report as Report1_Executive Summary.pdf (TNB01, period 0)"]);
  });

  it("keeps unreadable files in the list with the reason, after the good ones", async () => {
    const { items } = await importFiles([
      { name: "holiday.pdf", bytes: strToU8("not a pdf") },
      { name: "Report1_Executive Summary.pdf", bytes: pdfOf("Report1_Executive Summary.pdf") },
      { name: "Collective report_Period 0_Company 2_.pdf", bytes: strToU8("%PDF") },
      { name: "photos.zip", bytes: zipSync({ "a.jpg": strToU8("x") }) },
    ]);
    expect(items.map((i) => [i.source, i.preview.status])).toEqual([
      ["Report1_Executive Summary.pdf", "ok"],
      ["holiday.pdf", "error"],
      ["Collective report_Period 0_Company 2_.pdf", "error"],
      ["photos.zip", "error"],
    ]);
    const msg = (n: number) => (items[n].preview.status === "error" ? items[n].preview.message : "");
    expect(msg(1)).toMatch(/^Could not read this PDF/);
    expect(msg(2)).toBe("The collective report bundles all reports in one file — drop the ZIP or the individual report PDFs instead.");
    expect(msg(3)).toMatch(/^No TOPSIM reports in this ZIP/);
  });

  it("orderReports: oldest period first, then report code; the first copy of a report wins", () => {
    const item = (source: string, code: string, period: number): ImportItem =>
      ({ source, code, period, text: "", preview: { status: "empty" } });
    const { items, skipped } = orderReports([
      item("p1-bs", "TNB15", 1), item("p1-es", "TNB01", 1), item("p0-bs", "TNB15", 0), item("p1-es again", "TNB01", 1),
    ]);
    expect(items.map((i) => i.source)).toEqual(["p0-bs", "p1-es", "p1-bs"]);
    expect(skipped).toEqual(["p1-es again: same report as p1-es (TNB01, period 1)"]);
  });
});
