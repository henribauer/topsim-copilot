import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** One report cut out of the extracted P0 sample, between its "=== ReportNN_" marker and the next. */
export function p0Report(startMarker: string, endMarker: string): string {
  return readFileSync(resolve(import.meta.dirname, "../docs/p0_reports_sample.txt"), "utf8")
    .split(startMarker)[1]
    .split(endMarker)[0];
}
