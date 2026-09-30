export type CmUnit = "TEUR" | "EUR";

export interface ContributionMarginReport {
  reportCode: string;
  title: string;
  period: number;
  company: string;
  unit: CmUnit;
  channels: string[];
  steps: CmStep[];
  /** Page 2: the same cascade per unit sold (EUR); null if the page is missing. */
  perUnit: CmTable | null;
}

/** One table of the report: its unit, column headers and rows. */
export interface CmTable {
  unit: CmUnit;
  channels: string[];
  steps: CmStep[];
}

/** Column labels TOPSIM uses for the CM report, in their fixed order. */
const KNOWN_CHANNELS = [
  "Online-Market",
  "Bulk Buyer",
  "Requests for Bids",
  "Retail Market",
  "Special Market",
];
/** Last column is an aggregate; name differs between the Total and per-Unit tables. */
const AGGREGATE_COLUMNS = ["Total", "ø-Value"];

export interface CmStep {
  kind: "revenue" | "cost" | "margin";
  label: string;
  /** One value per channel column, same order as `channels`. */
  values: number[];
}

/** "6,000.00" → 6000 ; "-94.91" → -94.91 */
export function parseNumber(token: string): number {
  return Number(token.replace(/,/g, ""));
}

const NUMBER_RE = /^-?[\d,]+\.\d+$/;

/**
 * Parses a TOPSIM "TNB10: Contribution Margin" report (pasted text or
 * extracted PDF text — both arrive as plain text lines).
 */
export function parseContributionMargin(text: string): ContributionMarginReport {
  const lines = text.split("\n").map((l) => l.trim());

  const header = lines.find((l) => /^TNB10:/.test(l));
  if (!header) throw new Error("Not a TNB10 Contribution Margin report: missing 'TNB10:' header");

  const headerMatch = /^TNB10:\s*(.+?)\s+Period:\s*(\d+)$/.exec(header);
  if (!headerMatch) throw new Error(`Cannot parse header line: "${header}"`);

  const companyLine = lines.find((l) => l.includes("- Company "));
  const company = companyLine?.split(" - ").pop() ?? "";

  // Table titles, e.g. "Superbass - Contribution Margin Total (TEUR)" and
  // "... Accounting per Unit (EUR)" — in document order, one per table.
  const units = lines
    .filter(isTableTitle)
    .map((l) => /\((TEUR|EUR)\)\s*$/.exec(l)![1] as CmUnit);

  const channelRows = lines
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => KNOWN_CHANNELS.some((c) => l.startsWith(c)));
  if (channelRows.length === 0) throw new Error("Cannot find the channel header row");

  const tables = channelRows.map(({ l, i }, n) => ({
    unit: units[n] ?? (n === 0 ? "TEUR" : "EUR"),
    channels: parseChannels(l),
    steps: parseSteps(lines, i + 1),
  }));
  const [total, perUnit = null] = tables;

  return {
    reportCode: "TNB10",
    title: headerMatch[1],
    period: Number(headerMatch[2]),
    company,
    unit: total.unit,
    channels: total.channels,
    steps: total.steps,
    perUnit,
  };
}

function isTableTitle(line: string): boolean {
  return line.includes("Contribution Margin") && /\((TEUR|EUR)\)\s*$/.test(line);
}

/** Reads rows from `start` until the next page header (TNB10: …) or end of text. */
function parseSteps(lines: string[], start: number): CmStep[] {
  const steps: CmStep[] = [];
  let pendingLabel: string | null = null;
  for (const line of lines.slice(start)) {
    if (line.startsWith("===") || line.includes("Copyright (c)") || line === "") continue;
    if (isTableTitle(line)) continue;
    if (/^TNB\d+:/.test(line)) break;

    const tokens = line.split(/\s+/);
    const values: string[] = [];
    while (tokens.length > 0 && NUMBER_RE.test(tokens[tokens.length - 1])) {
      values.unshift(tokens.pop()!);
    }

    if (values.length === 0) {
      // Label text only (TOPSIM wraps long labels); keep it for the numeric line that follows.
      pendingLabel = (pendingLabel ? `${pendingLabel} ` : "") + tokens.join(" ");
      continue;
    }

    const rawLabel = pendingLabel ? `${pendingLabel} ${tokens.join(" ")}` : tokens.join(" ");
    pendingLabel = null;
    const trimmed = rawLabel.trim();
    const label = trimmed.replace(/\s+/g, " ").replace(/^[-=]\s*/, "");
    const kind: CmStep["kind"] =
      trimmed.startsWith("=") ? "margin" : trimmed.startsWith("-") ? "cost" : "revenue";
    steps.push({ kind, label, values: values.map(parseNumber) });
  }
  return steps;
}

/** Greedily matches channel names in the header row; ends at Total / ø-Value. */
function parseChannels(line: string): string[] {
  const channels: string[] = [];
  let rest = line.trim();
  while (rest.length > 0) {
    const aggregate = AGGREGATE_COLUMNS.find((a) => rest === a || rest.startsWith(a + " "));
    if (aggregate) {
      channels.push(aggregate);
      rest = rest.slice(aggregate.length).trim();
      continue;
    }
    const known = KNOWN_CHANNELS.find((c) => rest.startsWith(c));
    if (!known) throw new Error(`Unrecognised token in channel header row: "${rest}"`);
    channels.push(known);
    rest = rest.slice(known.length).trim();
  }
  return channels;
}
