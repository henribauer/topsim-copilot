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
  footnotes: string[];
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
  /** Printed header lines → clean column names. sparseRows: label → column index of each printed value. */
  columnHeaders?: { lines: string[]; columns: string[]; sparseRows?: Record<string, number[]> }[];
  /** Rows that may carry no value at all (a decision left blank), so they cannot be told from a wrapped label. */
  emptyRows?: string[];
  /** Footnote texts as printed (wrapped lines joined by a space). A footnote also ends the table above it. */
  footnotes?: string[];
  /** Label lines ending in a number that belongs to the label ("Long-term Loans gt 10" / "Periods"). */
  labelLines?: string[];
  /** Label with a number inside ("Type A Line Nr. 1 12,000 …"): the matched part is always label. */
  labelPattern?: RegExp;
  /** A label end printed on its own line below the values ("Type A Line Nr." / "-9 1,250.00 …" / "1"). */
  labelTail?: { after: RegExp; line: RegExp };
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
  TNB19: {
    name: "Decision Protocol",
    headings: ["Marketing Mix", "Product Development", "Bulk Buyer", "Purchase and Production", "Production Lines", "Human Resources"],
    emptyRows: ["Disinvestment Line No."],
  },
  TNB06: {
    name: "Human Resources",
    headings: ["Workforce", "Staffing Costs"],
    columnHeaders: [{ lines: ["Purchasing Administration Production Account Manager Total"], columns: ["Purchasing", "Administration", "Production", "Account Manager", "Total"] }],
    footnotes: ["(*) Without Overtime Costs"],
  },
  TNB05: {
    name: "Inventory",
    headings: ["Overview Inventory", "Superbass", "Input Materials/Parts Superbass", "Finished Products Superbass", "Storage Cost", "All Products"],
    columnHeaders: [
      { lines: ["Quantity Inventory", "Units EUR/per unit TEUR"], columns: ["Quantity (Units)", "EUR/per unit", "Inventory (TEUR)"] },
    ],
  },
  TNB16: {
    name: "Business Report of the Industry",
    headings: ["Cost of Sales Accounting (TEUR)", "Balance Sheet (TEUR)", "Assets", "Liabilities"],
    columnHeaders: [{ lines: ["C1 C2 C3 C4"], columns: ["C1", "C2", "C3", "C4"] }],
    labelLines: ["Long-term Loans gt 10", "Short-Term Loans lt 1"],
  },
  TNB04: {
    name: "Research & Development",
    headings: ["Superbass"],
    columnHeaders: [{
      lines: ["Level Previous Period Level Current Period Fixed Costs TEUR Variable Cost EUR/", "unit", "Variable Costs TEUR"],
      columns: ["Level Previous Period", "Level Current Period", "Fixed Costs (TEUR)", "Variable Cost (EUR/unit)", "Variable Costs (TEUR)"],
    }],
  },
  TNB03: {
    name: "Production Report",
    headings: ["Overview", "Superbass", "Production Lines", "Utilization Production Lines", "Utilization of Staff"],
    columnHeaders: [
      {
        lines: [
          "Acquisition", "Period", "Acquisition", "Value", "Remaining", "Residual Time",
          "Depreciation Net Book Value Other Fixed", "Costs", "Residual", "Earnings",
          "TEUR Periods TEUR/Period TEUR TEUR/Period % from Book", "Value",
        ],
        columns: [
          "Acquisition Period", "Acquisition Value (TEUR)", "Remaining Residual Time (Periods)", "Depreciation (TEUR/Period)",
          "Net Book Value (TEUR)", "Other Fixed Costs (TEUR/Period)", "Residual Earnings (% from Book Value)",
        ],
        // "Total 5,000.00 500.00 2,625.00 320.00": only the summable columns carry a total.
        sparseRows: { Total: [1, 3, 4, 5] },
      },
      { lines: ["Normal Capacity Maintenance", "Units TEUR Factor"], columns: ["Normal Capacity (Units)", "Maintenance (TEUR)", "Factor"] },
    ],
    labelPattern: /^Type [A-Z] Line Nr\.( \d+)?/,
    labelTail: { after: /Nr\.$/, line: /^\d+$/ },
  },
};

export const SECTIONED_CODES = Object.keys(LAYOUTS);

/** Longest first, so "EUR/per unit" wins over "EUR". */
const UNITS = ["Number per product", "EUR/per unit", "Units/Period", "TEUR", "EUR", "Units", "Number", "%"];
const VALUE_RE = /^[+-]?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$|^(Yes|No)$/;

export function parseSectionedReport(text: string): SectionedReport {
  const lines = text.split("\n").map((l) => l.replace(/\f/g, "").trim()).filter(Boolean);
  const code = lines.find((l) => /^TNB\d\d:/.test(l))?.slice(0, 5);
  const layout = code ? LAYOUTS[code] : undefined;
  if (!code || !layout) throw new Error(`Not a supported report: ${code ?? "no TNB code found"}`);
  const header = readHeader(lines, code, layout.name);

  const sections: Section[] = [];
  const footnotes: string[] = [];
  let current: Section | null = null;
  let sparse: Record<string, number[]> = {};
  let pending = "";
  const content = body(lines);
  for (let i = 0; i < content.length; i++) {
    const line = content[i];
    // "= Final" / "Workforce" / "Number 3.0 …": while a label is open, a heading-like line continues it.
    if (!pending && layout.headings.includes(line)) {
      // A heading straight after another (or after a bare column line) names the same table.
      if (current && current.rows.length === 0) current.heading = current.heading ? `${current.heading} · ${line}` : line;
      else sections.push((current = { heading: line, columns: [], rows: [] }));
      continue;
    }
    const colHeader = layout.columnHeaders?.find((h) => h.lines.every((l, k) => content[i + k] === l));
    const columns = /^(Period|P) \d+$/.test(line) ? [line] : colHeader?.columns;
    if (columns) {
      i += (colHeader?.lines.length ?? 1) - 1;
      if (!current || current.rows.length > 0) sections.push((current = { heading: "", columns: [], rows: [] }));
      current.columns = columns;
      sparse = colHeader?.sparseRows ?? {};
      continue;
    }
    const last = current?.rows.at(-1);
    if (!pending && last && layout.labelTail?.after.test(last.label) && layout.labelTail.line.test(line)) {
      last.label += ` ${line}`;
      continue;
    }
    const row = layout.labelLines?.includes(line) ? null
      : layout.emptyRows?.includes(line) ? { label: line, values: [] } : readRow(line, pending, layout.labelPattern);
    if (!row) {
      pending = joinWrapped(pending, line);
      if (layout.footnotes?.includes(pending)) {
        footnotes.push(pending);
        pending = "";
        current = null;
      }
      continue;
    }
    pending = "";
    if (!current) sections.push((current = { heading: "", columns: [], rows: [] }));
    const at = sparse[row.label];
    if (at && row.values.length === at.length) {
      const placed: Row["values"] = current.columns.map(() => ({ raw: "", n: null }));
      at.forEach((col, k) => (placed[col] = row.values[k]));
      row.values = placed;
    }
    // A blank cell (e.g. no market total for a share) is simply absent from the text; pad at the end.
    while (row.values.length < current.columns.length) row.values.push({ raw: "", n: null });
    current.rows.push(row);
  }
  return { reportCode: code, title: header.title, period: header.period, company: header.company, sections, footnotes };
}

/** Wrapped label lines join with a space, except after "/" ("Recruitment/" + "Dismissals/" → "Recruitment/Dismissals/"). */
function joinWrapped(head: string, tail: string): string {
  if (!head) return tail;
  return head.endsWith("/") ? head + tail : `${head} ${tail}`;
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

function readRow(line: string, pending: string, labelPattern?: RegExp): Row | null {
  const tokens = line.split(/\s+/);
  const fixed = labelPattern?.exec(line)?.[0].split(/\s+/).length ?? 0;
  let first = tokens.length;
  while (first > fixed && VALUE_RE.test(tokens[first - 1])) first--;
  if (first === tokens.length) return null;
  let label = tokens.slice(0, first).join(" ");
  const unit = UNITS.find((u) => label === u || label.endsWith(` ${u}`));
  if (unit) label = label.slice(0, label.length - unit.length).trim();
  label = label ? joinWrapped(pending, label) : pending;
  const sign = /^[+=-] /.exec(label)?.[0][0] as Row["sign"];
  if (sign) label = label.slice(2);
  const values = tokens.slice(first).map((raw) => ({ raw, n: /^(Yes|No)$/.test(raw) ? null : parseNumber(raw) }));
  return { ...(sign ? { sign } : {}), label, ...(unit ? { unit } : {}), values };
}
