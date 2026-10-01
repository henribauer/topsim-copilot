import { parseNumber } from "../parser/contributionMargin";

/** Where a value sits inside a parsed report, e.g. ["sections", 0, "rows", 3, "value"]. */
export type Path = (string | number)[];

/**
 * One manual fix of a misread value (PRD Must 1: "manual correction screen for any value the parser
 * misses"). It is stored next to the report, never written into `parsed` or `raw`, so a parser fix can
 * re-read the original text and Henri's fixes still sit on top — and every fix can be undone.
 */
export interface Correction {
  path: Path;
  /** The value the parser produced when the fix was made. */
  from: number | string;
  /** What Henri typed, in TOPSIM's own format ("6,100.00"). */
  to: string;
  at: string;
}

/** Returns a corrected copy of `parsed`; the input stays as parsed. */
export function applyCorrections<T>(parsed: T, corrections: Correction[]): { report: T; stale: Correction[] } {
  const report = structuredClone(parsed);
  const stale: Correction[] = [];
  for (const c of corrections) {
    const parent = c.path.slice(0, -1).reduce<any>((node, key) => node?.[key], report);
    const key = c.path[c.path.length - 1];
    const cell = parent?.[key];
    // Sectioned reports keep each cell as {raw, n}: compare and replace the printed text, so the
    // UI keeps showing numbers in TOPSIM's format (standing decision: numbers appear as printed).
    const printed = cell !== null && typeof cell === "object" && "raw" in cell;
    // Only overwrite what Henri actually saw. If a parser fix (or a re-import) changed the value
    // underneath, his fix may no longer be needed — show it to him instead of applying it blindly.
    if ((printed ? cell.raw : cell) !== c.from) {
      stale.push(c);
      continue;
    }
    parent[key] = printed ? { raw: c.to, n: parseNumber(c.to) } : parseNumber(c.to);
  }
  return { report, stale };
}
