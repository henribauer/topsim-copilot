export interface Citation {
  label: string;
  /** false → the label matches none of the sources the copilot was given: possibly invented. */
  known: boolean;
}

/**
 * Does a cited label point at this source? The model adds a section ("Handbook, 3.5.3 Taxes", "Handbook §3.5.3")
 * or shortens a report to its code ("Period 0 · TNB11"). Both are real. Look-alikes are not: the match must
 * end at a word break, and a shortened label must stop at a " · " boundary of the real one.
 */
function matches(label: string, source: string): boolean {
  if (label === source) return true;
  if (label.startsWith(source) && /^[\s,;:§.(\-–—]/.test(label.slice(source.length))) return true;
  return source.startsWith(`${label} · `) && /TNB\d+$/.test(label);
}

/**
 * The [bracketed] sources in an answer (PRD Must 6: "cites the report/handbook section"; design guide
 * D28 — Henri can audit what the answer rests on). "[Handbook §3.5.3]" counts as the Handbook; anything
 * that matches no source label is flagged instead of trusted.
 */
export function extractCitations(text: string, knownLabels: string[]): Citation[] {
  const out: Citation[] = [];
  // Not a markdown link "[text](url)"; at least 3 characters with a letter, so "[x]" and "[1]" are skipped.
  for (const m of text.matchAll(/\[([^\]\n]{3,})\](?!\()/g)) {
    const label = m[1].trim();
    if (!/[A-Za-z]/.test(label) || out.some((c) => c.label === label)) continue;
    out.push({ label, known: knownLabels.some((k) => matches(label, k)) });
  }
  return out;
}

/** "[label]" → "⟦n⟧", n = position in `citations` + 1; the page turns the marker into a link to the source list. */
export function numberCitations(text: string, citations: Citation[]): string {
  return text.replace(/\[([^\]\n]{3,})\](?!\()/g, (whole, label: string) => {
    const i = citations.findIndex((c) => c.label === label.trim());
    return i === -1 ? whole : `⟦${i + 1}⟧`;
  });
}
