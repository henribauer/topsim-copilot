import { useState } from "react";
import { searchGlossary, type Source } from "./learn/glossary";

const KIND: Record<Source["kind"], string> = {
  handbook: "Handbook",
  script: "Lecture script",
  report: "Report",
};

/** "Handbook §3.5.3 — Taxes", "Lecture script p. 28 — …", "Report TNB10 — …": one line per source. */
function sourceLine(s: Source): string {
  const page = /^### (p\. \d+)$/.exec(s.ref);
  const where = s.kind === "handbook" ? ` §${s.ref}` : s.kind === "report" ? ` ${s.ref}` : page ? ` ${page[1]}` : "";
  return `${KIND[s.kind]}${where} — ${s.title}`;
}

/**
 * Glossary (PRD Must 7). Search box on top, one card per term: definition, formula, and the handbook section,
 * lecture-script page and TOPSIM report it comes from. Each term can be handed to the copilot as a question
 * (it only fills the input — nothing is sent until Henri presses Ask).
 */
export function Glossary({ onAsk, initialQuery = "" }: { onAsk: (question: string) => void; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const hits = searchGlossary(query);
  return (
    <div className="glossary">
      <input
        className="search"
        type="search"
        aria-label="Search the glossary"
        placeholder="Search a term, e.g. break-even, overdraft, 35%…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <p className="muted count" role="status">
        {hits.length} term{hits.length === 1 ? "" : "s"}
        {query.trim() !== "" && ` matching "${query.trim()}"`}
      </p>
      {hits.length === 0 && <p className="muted">Nothing found. Try a shorter word, or ask the copilot.</p>}
      <div className="terms">
        {hits.map((e) => (
          <article key={e.term} className="card term">
            <h3>{e.term}</h3>
            <p>{e.definition}</p>
            {e.formula && <p className="formula">{e.formula}</p>}
            <ul className="term-sources">
              {e.sources.map((s) => (
                <li key={s.kind + s.ref + s.title}>{sourceLine(s)}</li>
              ))}
            </ul>
            <button className="link" onClick={() => onAsk(`Explain "${e.term}" using our numbers from the reports.`)}>
              Ask the copilot about this →
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
