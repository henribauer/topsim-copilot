import { parseNumber } from "./contributionMargin";
import { readHeader } from "./header";

export interface ProfitAndLossReport {
  reportCode: "TNB11";
  title: string;
  period: number;
  company: string;
  /** The report's blocks in document order (Total Cost Accounting, Cost of Sales Accounting, …). */
  sections: PnlSection[];
}

export interface PnlSection {
  title: string;
  rows: PnlRow[];
}

export interface PnlRow {
  /** The operator TOPSIM prints before the label; null for the starting line (e.g. Sales Revenue). */
  sign: "+" | "-" | "=" | null;
  label: string;
  /** TEUR. */
  value: number;
  /** The "% of Revenue" column; null where the report prints none (sub-items, TEUR-only blocks). */
  percentOfRevenue: number | null;
}

/** Block titles as TOPSIM prints them, in their fixed order. */
const KNOWN_SECTIONS = [
  "Total Cost Accounting",
  "Cost of Sales Accounting",
  "Net Income/Net Loss",
  "Appropriation of Net Income",
];

const NUMBER_RE = /^-?[\d,]+\.\d+$/;

/**
 * Parses a TOPSIM "TNB11: Profit and Loss Statement" report (pasted text or
 * extracted PDF text).
 */
export function parseProfitAndLoss(text: string): ProfitAndLossReport {
  const lines = text.split("\n").map((l) => l.trim());
  const { title, period, company, start } = readHeader(lines, "TNB11", "Profit and Loss");

  return {
    reportCode: "TNB11",
    title,
    period,
    company,
    sections: parseSections(lines.slice(start)),
  };
}

function parseSections(lines: string[]): PnlSection[] {
  const sections: PnlSection[] = [];
  let inPageHeader = false;
  let pendingLabel: string | null = null;
  // A signed label cut off by another signed row; its numbers arrive on a later bare-number line.
  let orphan: { label: string; index: number } | null = null;

  for (const line of lines) {
    // Every page repeats "TNB11: …" down to the company line — skip that block.
    if (/^TNB11:/.test(line)) inPageHeader = true;
    if (inPageHeader) {
      if (line.includes("- Company ")) inPageHeader = false;
      continue;
    }
    if (line === "" || line.startsWith("===") || line.includes("Copyright (c)")) continue;
    if (/^TEUR(\s+% of Revenue)?$/.test(line)) continue; // column header row

    if (KNOWN_SECTIONS.includes(line)) {
      sections.push({ title: line, rows: [] });
      continue;
    }
    const section = sections.at(-1);
    if (!section) continue;

    const tokens = line.split(/\s+/);
    const values: string[] = [];
    while (values.length < 2 && tokens.length > 0 && NUMBER_RE.test(tokens[tokens.length - 1])) {
      values.unshift(tokens.pop()!);
    }
    if (values.length === 0) {
      pendingLabel = (pendingLabel ? `${pendingLabel} ` : "") + tokens.join(" ");
      continue;
    }
    const own = tokens.join(" ");
    if (own === "" && orphan) {
      section.rows.splice(orphan.index, 0, toRow(orphan.label, values));
      orphan = null;
      continue;
    }
    if (pendingLabel && /^[+\-=]\s/.test(pendingLabel) && /^[+\-=]\s/.test(own)) {
      orphan = { label: pendingLabel, index: section.rows.length };
      pendingLabel = null;
    }
    const raw = (pendingLabel ? `${pendingLabel} ${own}` : own).trim();
    pendingLabel = null;
    section.rows.push(toRow(raw, values));
  }
  return sections;
}

function toRow(rawLabel: string, values: string[]): PnlRow {
  const signMatch = /^([+\-=])\s+/.exec(rawLabel);
  return {
    sign: signMatch ? (signMatch[1] as PnlRow["sign"]) : null,
    label: rawLabel.replace(/^[+\-=]\s+/, "").replace(/\s+/g, " "),
    value: parseNumber(values[0]),
    percentOfRevenue: values.length > 1 ? parseNumber(values[1]) : null,
  };
}
