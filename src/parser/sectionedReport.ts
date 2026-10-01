import { parseNumber } from "./contributionMargin";
import { readHeader } from "./header";

/**
 * The "plain" TOPSIM reports (Executive Summary, Production, HR, Cash Accounting, …) are all the
 * same shape: section headings, an optional column-header line, then rows of
 * "label [unit] value value …". One reader plus a small layout entry per report (LAYOUTS) covers
 * them; the layout lists what cannot be told apart from a wrapped label by looking at one line.
 */
export interface SectionedReport {
  reportCode: string;
  title: string;
  period: number;
  company: string;
  sections: Section[];
}

export interface Section {
  heading: string;
  columns: string[];
  rows: Row[];
}

export interface Row {
  /** Calculation sign TOPSIM prints in front of the label ("+ Depreciation", "= Final Inventory"). */
  sign?: "+" | "-" | "=";
  label: string;
  unit?: string;
  /** `raw` is TOPSIM's own formatting ("40,000", "8.0", "Yes"); `n` is null for non-numbers. */
  values: { raw: string; n: number | null }[];
}

interface Layout {
  name: string;
  /** Lines that open a section. Consecutive headings merge ("Overview · Superbass"). */
  headings: string[];
  /** Column headers that are not "Period n"; `lines` as extracted, `columns` as shown. */
  columnHeaders?: { lines: string[]; columns: string[] }[];
}

const LAYOUTS: Record<string, Layout> = {
  TNB01: {
    name: "Executive Summary",
    headings: ["General", "Market", "Superbass | Online-Market", "Production", "Cost Structure", "Performance Indicators", "Finance"],
  },
  TNB02: {
    name: "Market Research Report",
    headings: ["Superbass - Online-Market"],
    columnHeaders: [{ lines: ["C1 C2 C3 C4 ø-Value / Total"], columns: ["C1", "C2", "C3", "C4", "ø-Value / Total"] }],
  },
  TNB12: {
    name: "Cash Accounting",
    headings: ["Cash Inflows", "Cash Outflows", "Payment Conditions"],
    columnHeaders: [
      { lines: ["TEUR"], columns: ["TEUR"] },
      { lines: ["% in the Actual Period"], columns: ["% in the Actual Period"] },
    ],
  },
  TNB14: {
    name: "Cash-Flow Statement",
    headings: [],
    columnHeaders: [{ lines: ["TEUR"], columns: ["TEUR"] }],
  },
};

export const SECTIONED_CODES = Object.keys(LAYOUTS);

/** Longest first, so "EUR/per unit" wins over "EUR". */
const UNITS = ["EUR/per unit", "TEUR", "EUR", "Units", "Number", "%"];
const VALUE_RE = /^[+-]?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$|^(Yes|No)$/;

export function parseSectionedReport(text: string): SectionedReport {
  const lines = text.split("\n").map((l) => l.replace(/\f/g, "").trim()).filter(Boolean);
  const code = lines.find((l) => /^TNB\d\d:/.test(l))?.slice(0, 5);
  const layout = code ? LAYOUTS[code] : undefined;
  if (!code || !layout) throw new Error(`Not a supported report: ${code ?? "no TNB code found"}`);
  const header = readHeader(lines, code, layout.name);

  const sections: Section[] = [];
  let current: Section | null = null;
  let pending = "";
  for (const line of body(lines)) {
    if (layout.headings.includes(line)) {
      if (current && current.rows.length === 0 && current.columns.length === 0) current.heading += ` · ${line}`;
      else sections.push((current = { heading: line, columns: [], rows: [] }));
      continue;
    }
    const columns = /^Period \d+$/.test(line) ? [line] : layout.columnHeaders?.find((h) => h.lines[0] === line)?.columns;
    if (columns) {
      if (!current || current.rows.length > 0) sections.push((current = { heading: "", columns: [], rows: [] }));
      current.columns = columns;
      continue;
    }
    const row = readRow(line, pending);
    if (!row) {
      pending = pending ? `${pending} ${line}` : line;
      continue;
    }
    pending = "";
    if (!current) sections.push((current = { heading: "", columns: [], rows: [] }));
    // A blank cell (e.g. no market total for a share) is simply absent from the text; pad at the end.
    while (row.values.length < current.columns.length) row.values.push({ raw: "", n: null });
    current.rows.push(row);
  }
  return { reportCode: code, title: header.title, period: header.period, company: header.company, sections };
}

/** Drops the page header (TNB line … "- Company n") and footer ("- Page n …") of every page. */
function body(lines: string[]): string[] {
  const out: string[] = [];
  let inHeader = false;
  for (const line of lines) {
    if (/^TNB\d\d:/.test(line)) inHeader = true;
    else if (inHeader && line.includes("- Company ")) inHeader = false;
    else if (!inHeader && !line.startsWith("- Page ")) out.push(line);
  }
  return out;
}

function readRow(line: string, pending: string): Row | null {
  const tokens = line.split(/\s+/);
  let first = tokens.length;
  while (first > 0 && VALUE_RE.test(tokens[first - 1])) first--;
  if (first === tokens.length) return null;
  let label = tokens.slice(0, first).join(" ");
  const unit = UNITS.find((u) => label === u || label.endsWith(` ${u}`));
  if (unit) label = label.slice(0, label.length - unit.length).trim();
  label = [pending, label].filter(Boolean).join(" ");
  const sign = /^[+=-] /.exec(label)?.[0][0] as Row["sign"];
  if (sign) label = label.slice(2);
  const values = tokens.slice(first).map((raw) => ({ raw, n: /^(Yes|No)$/.test(raw) ? null : parseNumber(raw) }));
  return { ...(sign ? { sign } : {}), label, ...(unit ? { unit } : {}), values };
}
