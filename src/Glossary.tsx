import { useState } from "react";
import { GLOSSARY, entriesForLetter, letterIndex, searchGlossary, type Source } from "./learn/glossary";

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
  const letters = letterIndex(GLOSSARY);
  const [letter, setLetter] = useState(letters[0].letter);
  const [open, setOpen] = useState<string | null>(null);
  const searching = query.trim() !== "";
  // Uxcel: one letter strip is the only navigation. A search replaces it, so the two never compete (D32).
  const hits = searching ? searchGlossary(query) : entriesForLetter(GLOSSARY, letter);
  // A term handed over from the quiz opens straight away.
  const auto = searching && hits.length === 1 ? hits[0].term : null;
  return (
    <div className="glossary">
      <input
        className="search"
        type="search"
        aria-label="Search the glossary"
        placeholder="Search a term, e.g. break-even, overdraft, 35%…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(null);
        }}
      />
      <nav className="letters" aria-label="Jump to letter">
        {letters.map((l) => (
          <button key={l.letter} className={!searching && l.letter === letter ? "letter active" : "letter"} aria-pressed={!searching && l.letter === letter}
            title={`${l.count} term${l.count === 1 ? "" : "s"}`}
            onClick={() => { setQuery(""); setLetter(l.letter); setOpen(null); }}>
            {l.letter}
          </button>
        ))}
      </nav>
      {/* Selfridges: restate where we are as a big heading. */}
      <h2 className="letter-title" role="status">
        {searching ? `${hits.length} result${hits.length === 1 ? "" : "s"} for “${query.trim()}”` : letter}
      </h2>
      {hits.length === 0 && <p className="muted">Nothing found. Try a shorter word, or ask the copilot.</p>}
      <ul className="term-rows">
        {hits.map((e) => {
          const isOpen = open === e.term || auto === e.term;
          return (
            <li key={e.term} className={isOpen ? "term-row open" : "term-row"}>
              <button className="term-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen && open === e.term ? null : e.term)}>
                <span className="term-name">{e.term}</span>
                <span className="term-line">{e.definition.split(/(?<=[.!?])\s/)[0]}</span>
              </button>
              {isOpen && (
                <div className="term-body">
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
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
