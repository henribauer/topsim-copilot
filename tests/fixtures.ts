import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { loadPeriods, saveReport, type PeriodFile } from "../src/store/periodStore";
import { join, resolve } from "node:path";

/** One report cut out of the extracted P0 sample, between its "=== ReportNN_" marker and the next. */
export function p0Report(startMarker: string, endMarker: string): string {
  return readFileSync(resolve(import.meta.dirname, "../docs/p0_reports_sample.txt"), "utf8")
    .split(startMarker)[1]
    .split(endMarker)[0];
}

/** The complete real period 0 (all 16 reports), saved into a throw-away vault and loaded back the way the app does. */
export function savedP0(): PeriodFile {
  const dir = mkdtempSync(join(tmpdir(), "topsim-p0-"));
  const names = readFileSync(resolve(import.meta.dirname, "../docs/p0_reports_sample.txt"), "utf8")
    .split("\n")
    .filter((l) => l.startsWith("=== Report"));
  for (const n of names) saveReport(dir, p0Report(n, "=== "));
  return loadPeriods(dir)[0];
}
