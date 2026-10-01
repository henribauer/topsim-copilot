import { parseNumber } from "./contributionMargin";
import { readHeader } from "./header";

/**
 * TNB07 Cost Type and TNB08 Cost Center Accounting print the same grid: the cost
 * types (rows) in four groups, then a total line. They differ only in the columns
 * (Cost Type: Total / Overhead / Direct; Cost Center: Total + five cost centers).
 */
const GROUPS = ["Material Costs", "Staffing Costs", "Depreciation", "Other Costs"] as const;

export interface CostTypeReport {
  reportCode: "TNB07";
  title: string;
  period: number;
  company: string;
  groups: CostGroup<CostTypeRow>[];
  total: Omit<CostTypeRow, "label" | "note">;
}

export interface CostGroup<Row> {
  name: string;
  rows: Row[];
}

/** One cost type, TEUR. Overhead goes on to cost center accounting; direct costs go straight to the product. */
export interface CostTypeRow {
  label: string;
  total: number;
  overhead: number;
  direct: number;
  /** Footnote TOPSIM attaches with "(*)", e.g. wages include overtime costs. */
  note?: string;
}

/** Parses a TOPSIM "TNB07: Cost Type Accounting" report (pasted text or extracted PDF text). */
export function parseCostTypeAccounting(text: string): CostTypeReport {
  const lines = text.split("\n").map((l) => l.trim());
  const { title, period, company } = readHeader(lines, "TNB07", "Cost Type Accounting");
  const grid = readCostGrid(lines, 3);
  return {
    reportCode: "TNB07", title, period, company,
    groups: grid.groups.map((g) => ({
      name: g.name,
      rows: g.rows.map(({ label, values: [total, overhead, direct], note }) => ({
        label, total, overhead, direct, ...(note ? { note } : {}),
      })),
    })),
    total: { total: grid.total[0], overhead: grid.total[1], direct: grid.total[2] },
  };
}

export interface CostCenterReport {
  reportCode: "TNB08";
  title: string;
  period: number;
  company: string;
  /** Cost centers in column order, as printed ("Purchasing", "Production", …). */
  centers: string[];
  groups: CostGroup<CostCenterRow>[];
  total: Omit<CostCenterRow, "label" | "note">;
}

/** The overhead of one cost type (TEUR), distributed to the cost centers that caused it. */
export interface CostCenterRow {
  label: string;
  total: number;
  /** Same order as `CostCenterReport.centers`. */
  byCenter: number[];
  note?: string;
}

/** Parses a TOPSIM "TNB08: Cost Center Accounting" report (pasted text or extracted PDF text). */
export function parseCostCenterAccounting(text: string): CostCenterReport {
  const lines = text.split("\n").map((l) => l.trim());
  const { title, period, company } = readHeader(lines, "TNB08", "Cost Center Accounting");
  // Column header right above the first group: "Total Purchasing Production R&D Sales Administration".
  const columnLine = lines[lines.findIndex((l) => (GROUPS as readonly string[]).includes(l)) - 1] ?? "";
  const centers = columnLine.split(/\s+/).slice(1);
  const grid = readCostGrid(lines, centers.length + 1);
  const toRow = (values: number[]) => ({ total: values[0], byCenter: values.slice(1) });
  return {
    reportCode: "TNB08", title, period, company, centers,
    groups: grid.groups.map((g) => ({
      name: g.name,
      rows: g.rows.map(({ label, values, note }) => ({ label, ...toRow(values), ...(note ? { note } : {}) })),
    })),
    total: toRow(grid.total),
  };
}

export interface CostUnitReport {
  reportCode: "TNB09";
  title: string;
  period: number;
  company: string;
  /** Products in column order (the simulation has one: "Superbass"). */
  products: string[];
  /** TEUR block: per step the company total and the amount per product. */
  totals: (CostUnitStep & { total: number })[];
  /** EUR per unit block: one value per product, no company total. */
  perUnit: CostUnitStep[];
}

/** One step of the cost unit calculation: "+" adds a cost block, "=" is a subtotal. */
export interface CostUnitStep {
  sign: "+" | "=" | "+/-";
  label: string;
  /** Same order as `CostUnitReport.products`. */
  byProduct: number[];
  /** Footnote TOPSIM attaches with "(*)" / "(**)", e.g. what quantity a per-unit value is based on. */
  note?: string;
}

/** Parses a TOPSIM "TNB09: Cost Unit Accounting" report (pasted text or extracted PDF text). */
export function parseCostUnitAccounting(text: string): CostUnitReport {
  const lines = text.split("\n").map((l) => l.trim());
  const { title, period, company } = readHeader(lines, "TNB09", "Cost Unit Accounting");
  const head = lines.findIndex((l) => l.startsWith(ALLOCATION_HEAD));
  if (head === -1) throw new Error(`Cost Unit Accounting: missing "${ALLOCATION_HEAD}" column line`);
  const products = lines[head].slice(ALLOCATION_HEAD.length).split(/\s+/).filter(Boolean).slice(1); // drop "Total"
  const totals = readSteps(lines.slice(head + 1), products.length + 1).map(({ sign, label, values }) => ({
    sign, label, total: values[0], byProduct: values.slice(1),
  }));

  // Second block: "Per Unit (EUR)" / "Cost Center Allocation Superbass" — one column per product.
  const unitHead = lines.findIndex((l, i) => i > head && l.startsWith(ALLOCATION_HEAD));
  if (unitHead === -1) throw new Error("Cost Unit Accounting: missing per-unit block");
  const unitLines = lines.slice(unitHead + 1);
  const notes = readFootnotes(unitLines);
  const perUnit = readSteps(unitLines, products.length).map(({ sign, label, values }) => {
    const mark = /\((\*+)\)$/.exec(label)?.[0];
    const clean = mark ? label.slice(0, -mark.length).trim() : label;
    const note = mark ? notes.get(mark) : undefined;
    return { sign, label: clean, byProduct: values, ...(note ? { note } : {}) };
  });
  return { reportCode: "TNB09", title, period, company, products, totals, perUnit };
}

/** "(*) The Cost of …" / "proportion to the quantity produced." → Map{"(*)" → full sentence}. */
function readFootnotes(lines: string[]): Map<string, string> {
  const notes = new Map<string, string>();
  let mark: string | null = null;
  for (const line of lines) {
    if (line.startsWith("- Page") || line.startsWith("===")) break;
    const start = FOOTNOTE_RE.exec(line);
    if (start) {
      mark = start[1];
      notes.set(mark, start[2]);
    } else if (mark) {
      notes.set(mark, `${notes.get(mark)} ${line}`);
    }
  }
  return notes;
}

const ALLOCATION_HEAD = "Cost Center Allocation";
const STEP_RE = /^(\+\/-|\+|=)\s+(.*)$/;

/**
 * Reads "+ label numbers" / "= label numbers" lines until the block ends. A wrapped
 * step prints its label over two lines and its numbers on a third
 * ("+/- Increase/Decrease in Finished" / "Goods Inventory" / "-94.91 -94.91").
 */
function readSteps(lines: string[], columns: number) {
  const steps: { sign: CostUnitStep["sign"]; label: string; values: number[] }[] = [];
  let open: { sign: CostUnitStep["sign"]; label: string } | null = null;
  for (const line of lines) {
    const step = STEP_RE.exec(line);
    if (!step && !open) break; // next block heading ("Per Unit (EUR)") or footnotes
    const tokens = (step ? step[2] : line).split(/\s+/);
    const numbers = tokens.filter((t) => NUMBER_RE.test(t));
    const words = tokens.slice(0, tokens.length - numbers.length).join(" ");
    const sign: CostUnitStep["sign"] = step ? (step[1] as CostUnitStep["sign"]) : open!.sign;
    const label: string = step ? words : join(open!.label, words);
    if (numbers.length === 0) {
      open = { sign, label };
      continue;
    }
    if (numbers.length !== columns) throw new Error(`Cost Unit Accounting: expected ${columns} numbers in "${line}"`);
    steps.push({ sign, label, values: numbers.map(parseNumber) });
    open = null;
  }
  return steps;
}

interface GridRow {
  label: string;
  values: number[];
  note?: string;
}

const NUMBER_RE = /^-?[\d,]+\.\d+$/;
const FOOTNOTE_MARK = "(*)";
const FOOTNOTE_RE = /^(\(\*+\))\s+(.*)$/;

/**
 * Reads the group/row grid. A row is label words followed by `columns` numbers; TOPSIM
 * wraps long labels over several lines and then prints the numbers on a line of their
 * own ("Recruitment/" / "Dismissals/" / "Training" / "90.00 15.00 …").
 */
function readCostGrid(lines: string[], columns: number) {
  const groups: CostGroup<GridRow>[] = [];
  const marked: GridRow[] = [];
  let pending = "";
  let total: number[] | null = null;

  const first = lines.findIndex((l) => (GROUPS as readonly string[]).includes(l));
  for (const line of lines.slice(first)) {
    // Footnotes ("(*) with Overtime Costs") close the grid; a bare "(*)" is the wrapped tail of a label.
    if (FOOTNOTE_RE.test(line) || line.startsWith("- Page") || line.startsWith("===")) break;
    if ((GROUPS as readonly string[]).includes(line)) {
      groups.push({ name: line, rows: [] });
      continue;
    }
    const tokens = line.split(/\s+/);
    const numbers = tokens.filter((t) => NUMBER_RE.test(t));
    if (numbers.length === 0) {
      pending = join(pending, line);
      continue;
    }
    const raw = join(pending, tokens.slice(0, tokens.length - numbers.length).join(" "));
    pending = "";
    if (numbers.length !== columns) throw new Error(`Cost grid: expected ${columns} numbers in "${line}"`);
    // "Total" (TNB07) / "Total Costs" (TNB08) closes the grid.
    if (/^Total( Costs)?$/.test(raw)) {
      total = numbers.map(parseNumber);
      continue;
    }
    const row: GridRow = { label: raw.replace(FOOTNOTE_MARK, "").trim(), values: numbers.map(parseNumber) };
    if (raw.includes(FOOTNOTE_MARK)) marked.push(row);
    groups.at(-1)?.rows.push(row);
  }
  const note = readFootnotes(lines).get(FOOTNOTE_MARK);
  for (const row of marked) if (note) row.note = note;
  if (!total) throw new Error("Cost grid: missing total line");
  return { groups, total };
}

/** "Input Materials/" + "Parts" → "Input Materials/Parts"; other wraps join with a space. */
function join(head: string, tail: string): string {
  if (!head) return tail;
  if (!tail) return head;
  return head.endsWith("/") ? head + tail : `${head} ${tail}`;
}
