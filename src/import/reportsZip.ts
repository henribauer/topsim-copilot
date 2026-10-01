import { unzipSync } from "fflate";

/** One report PDF found in TOPSIM's "download all reports" ZIP. */
export interface ZipReport {
  period: number;
  company: string;
  /** "Report1_Executive Summary.pdf" */
  fileName: string;
  /** TOPSIM's report number from the file name (1 … 20, with gaps). */
  number: number;
  bytes: Uint8Array;
}

// TOPSIM layout: "Period 0/Company 2/Individual reports/Report1_Executive Summary.pdf".
// The "Collective report_…pdf" next to it holds the same reports in one file, so it is skipped.
const REPORT_PATH = /^Period (\d+)\/([^/]+)\/Individual reports\/(Report(\d+)_[^/]+\.pdf)$/;

/** The individual reports in the ZIP, oldest period first, then by report number. */
export function listZipReports(zip: Uint8Array): ZipReport[] {
  const reports: ZipReport[] = [];
  for (const [path, bytes] of Object.entries(unzipSync(zip))) {
    const m = REPORT_PATH.exec(path);
    if (m) reports.push({ period: Number(m[1]), company: m[2], fileName: m[3], number: Number(m[4]), bytes });
  }
  if (reports.length === 0) {
    throw new Error("No TOPSIM reports in this ZIP (expected 'Period <n>/<company>/Individual reports/Report<n>_….pdf')");
  }
  return reports.sort((a, b) => a.period - b.period || a.number - b.number);
}
