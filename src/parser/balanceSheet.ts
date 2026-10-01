import { parseNumber } from "./contributionMargin";
import { readHeader } from "./header";

export interface BalanceSheetReport {
  reportCode: "TNB15";
  title: string;
  period: number;
  company: string;
  assets: BsRow[];
  liabilities: BsRow[];
  /** "Balance Sheet Total" for each side; both sides must be equal. */
  total: { assets: PeriodPair; liabilities: PeriodPair };
}

export interface PeriodPair {
  current: number;
  previous: number;
}

export interface BsRow {
  label: string;
  /** Group lines (Fixed Assets, Equity, …) are the sum of the items listed below them. */
  group: boolean;
  /** TEUR at the end of this period. */
  current: number;
  /** TEUR at the end of the previous period. */
  previous: number;
}

type Side = "assets" | "liabilities";

/**
 * The fixed row set of the TOPSIM balance sheet (handbook 3.4.9; P0 report TNB15).
 * TOPSIM prints both sides next to each other, so the extracted text interleaves
 * them and wraps long labels — matching against this list keeps the sides apart.
 */
const KNOWN_ROWS: { label: string; side: Side; group: boolean }[] = [
  { label: "Fixed Assets", side: "assets", group: true },
  { label: "Property and Buildings", side: "assets", group: false },
  { label: "Machines and Production Facilities", side: "assets", group: false },
  { label: "Current Assets", side: "assets", group: true },
  { label: "Input Materials", side: "assets", group: false },
  { label: "Finished Products", side: "assets", group: false },
  { label: "Trade Receivables", side: "assets", group: false },
  { label: "Securities", side: "assets", group: false },
  { label: "Cash Balance", side: "assets", group: false },
  { label: "Equity", side: "liabilities", group: true },
  { label: "Share Capital", side: "liabilities", group: false },
  { label: "Capital Reserves", side: "liabilities", group: false },
  { label: "Retained Earnings", side: "liabilities", group: false },
  { label: "Profit/Loss carried forward", side: "liabilities", group: false },
  { label: "Net Income/Loss", side: "liabilities", group: false },
  { label: "Liabilities", side: "liabilities", group: true },
  { label: "Long-term Loans gt 10 Periods", side: "liabilities", group: false },
  { label: "Short-Term Loans lt 1 Period", side: "liabilities", group: false },
  { label: "Overdraft Loans", side: "liabilities", group: false },
];

const NUMBER_RE = /^-?[\d,]+\.\d+$/;
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Parses a TOPSIM "TNB15: Balance Sheet" report (pasted text or extracted PDF text).
 */
export function parseBalanceSheet(text: string): BalanceSheetReport {
  const lines = text.split("\n").map((l) => l.trim());
  const { title, period, company, start } = readHeader(lines, "TNB15", "Balance Sheet");

  const report: BalanceSheetReport = {
    reportCode: "TNB15", title, period, company, assets: [], liabilities: [],
    total: readTotals(lines),
  };
  for (const { label, numbers } of chunks(bodyTokens(lines.slice(start)))) {
    const known = matchKnown(label);
    report[known.side].push({
      label: known.label, group: known.group,
      current: parseNumber(numbers[0]), previous: parseNumber(numbers[1]),
    });
  }
  return report;
}

/** "Balance Sheet Total 4,349.91 3,600.00 4,349.91 3,600.00" → assets pair, liabilities pair. */
function readTotals(lines: string[]): BalanceSheetReport["total"] {
  const line = lines.find((l) => /^Balance Sheet Total/.test(l));
  const n = (line ?? "").split(/\s+/).filter((t) => NUMBER_RE.test(t)).map(parseNumber);
  if (n.length !== 4) throw new Error(`Balance Sheet: cannot read "Balance Sheet Total" line: "${line ?? ""}"`);
  return {
    assets: { current: n[0], previous: n[1] },
    liabilities: { current: n[2], previous: n[3] },
  };
}

/** All words of the report body in reading order, page headers and column titles removed. */
function bodyTokens(lines: string[]): string[] {
  // The report is one page: the body starts after the header's company line.
  const body = lines.slice(lines.findIndex((l) => l.includes("- Company ")) + 1);
  const tokens: string[] = [];
  for (const line of body) {
    if (line === "" || line.startsWith("===") || line.includes("Copyright (c)")) continue;
    if (/\(TEUR\)/.test(line) || /^Current Period Previous Period/.test(line)) continue;
    if (/^Balance Sheet Total/.test(line)) break; // totals are read separately
    tokens.push(...line.split(/\s+/));
  }
  return tokens;
}

/** Splits the token stream into "label words, then a current/previous number pair". */
function chunks(tokens: string[]): { label: string; numbers: [string, string] }[] {
  const out: { label: string; numbers: [string, string] }[] = [];
  let words: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (NUMBER_RE.test(tokens[i]) && NUMBER_RE.test(tokens[i + 1] ?? "")) {
      out.push({ label: words.join(" "), numbers: [tokens[i], tokens[i + 1]] });
      words = [];
      i++;
    } else {
      words.push(tokens[i]);
    }
  }
  return out;
}

/**
 * A chunk's words may carry the tail of the previous wrapped label in front
 * ("forward Finished Products") or be cut short ("Profit/Loss carried"), so a
 * chunk matches a known label it ends with, or that starts with the chunk.
 */
function matchKnown(chunkLabel: string) {
  const c = norm(chunkLabel);
  const known =
    KNOWN_ROWS.find((k) => c === norm(k.label)) ??
    KNOWN_ROWS.find((k) => c.endsWith(` ${norm(k.label)}`)) ??
    KNOWN_ROWS.find((k) => c !== "" && norm(k.label).startsWith(c));
  if (!known) throw new Error(`Balance Sheet: unknown row "${chunkLabel}"`);
  return known;
}
