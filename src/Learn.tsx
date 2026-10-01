import { useEffect, useState } from "react";
import { cmCascade } from "./analysis/analysis";
import { gradeAnswer, generateQuiz, summarize, type Grade, type Question } from "./learn/quiz";
import type { PeriodFile } from "./store/periodStore";

/**
 * Learn (PRD Must 7): "after each period, a short quiz on the concepts that drove the result". Questions use the
 * period's own numbers (corrections included); every answer shows the worked solution with the lecture's formula,
 * and the end screen lists the glossary terms to revisit. Coach style: one question at a time, feedback at once.
 * Results live only in this session — the quiz is practice, not a record.
 */
export function Learn({ onGlossary, onAsk, onImport }: { onGlossary: (term: string) => void; onAsk: (q: string) => void; onImport: () => void }) {
  const [periods, setPeriods] = useState<PeriodFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/periods")
      .then((r) => r.json())
      .then((b) => setPeriods(b.periods))
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <div className="error" role="alert"><strong>Could not load the periods.</strong> {error}</div>;
  if (!periods) return <p className="muted">Loading…</p>;
  const usable = periods.filter((p) => cmCascade(p)).sort((a, b) => a.period - b.period);
  if (usable.length === 0) {
    return (
      <div className="card empty">
        <p>The quiz is built from your reports. Import a period (at least the Contribution Margin report) and the questions use your own numbers.</p>
        <button className="primary" onClick={onImport}>Import reports</button>
      </div>
    );
  }
  const period = usable.find((p) => p.period === selected) ?? usable[usable.length - 1];
  return (
    <div className="learn">
      {usable.length > 1 && (
        <div className="period-pick" role="tablist" aria-label="Period">
          {usable.map((p) => (
            <button key={p.period} role="tab" aria-selected={p.period === period.period}
              className={p.period === period.period ? "tab active" : "tab"} onClick={() => setSelected(p.period)}>
              Period {p.period}
            </button>
          ))}
        </div>
      )}
      {/* key: a new period starts a fresh quiz */}
      <Quiz key={period.period} period={period} onGlossary={onGlossary} onAsk={onAsk} />
    </div>
  );
}

function Quiz({ period, onGlossary, onAsk }: { period: PeriodFile; onGlossary: (term: string) => void; onAsk: (q: string) => void }) {
  const [quiz] = useState(() => generateQuiz(period));
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [choice, setChoice] = useState<number | null>(null);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [results, setResults] = useState<{ id: string; correct: boolean | null }[]>([]);

  if (index >= quiz.length) {
    const s = summarize(quiz, results);
    return (
      <section className="card a-card">
        <h2>Period {period.period} quiz · done</h2>
        <p className="big">{s.correct} of {s.total} correct</p>
        {s.revisit.length === 0 ? (
          <p>Every concept sat. Next: change something in the What-if or ask the copilot why a number moved.</p>
        ) : (
          <>
            <p>Worth another look:</p>
            <ul className="revisit">
              {s.revisit.map((t) => (
                <li key={t}><button className="link" onClick={() => onGlossary(t)}>{t} →</button></li>
              ))}
            </ul>
          </>
        )}
        <div className="actions">
          <button className="primary" onClick={() => { setIndex(0); setResults([]); setGrade(null); setInput(""); setChoice(null); }}>Try again</button>
        </div>
      </section>
    );
  }

  const q: Question = quiz[index];
  const answered = grade !== null && grade.correct !== null;

  function check() {
    const g = gradeAnswer(q, q.kind === "choice" ? (choice ?? -1) : input);
    setGrade(g);
    if (g.correct !== null) setResults((r) => [...r, { id: q.id, correct: g.correct }]);
  }
  function next() {
    setIndex(index + 1);
    setGrade(null);
    setInput("");
    setChoice(null);
  }

  return (
    <section className="card a-card quiz">
      <h2>Period {period.period} quiz</h2>
      <p className="muted">Question {index + 1} of {quiz.length} · about {q.concept}. Questions use your own numbers.</p>
      <progress value={index} max={quiz.length} aria-label="Quiz progress" />
      <p className="q-prompt">{q.prompt}</p>
      {q.kind === "choice" ? (
        <div className="choices" role="radiogroup" aria-label="Answer">
          {q.choices!.map((c, i) => (
            <button key={c} role="radio" aria-checked={choice === i} disabled={answered}
              className={`choice${choice === i ? " active" : ""}${answered && i === q.answer ? " right" : ""}${answered && choice === i && i !== q.answer ? " wrong" : ""}`}
              onClick={() => setChoice(i)}>
              {c}
            </button>
          ))}
        </div>
      ) : (
        <div className="answer-row">
          <input aria-label="Your answer" inputMode="decimal" value={input} disabled={answered} placeholder={q.unit ? `Your answer in ${q.unit}` : "Your answer"}
            onChange={(e) => { setInput(e.target.value); if (grade) setGrade(null); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !answered && input.trim() !== "") check(); }} />
          <span className="muted">{q.unit}</span>
        </div>
      )}
      {grade && (
        <div className={grade.correct === true ? "fb ok" : grade.correct === false ? "fb bad" : "fb"} role="status">
          {grade.correct === true && <strong>✓ </strong>}
          {grade.feedback}
          {answered && <div><button className="link" onClick={() => onAsk(`I got this quiz question ${grade.correct ? "right but want to understand it better" : "wrong"}: "${q.prompt}" Explain it step by step.`)}>Ask the copilot to explain →</button></div>}
        </div>
      )}
      <div className="actions">
        {answered ? (
          <button className="primary" onClick={next}>{index + 1 === quiz.length ? "See result" : "Next question"}</button>
        ) : (
          <button className="primary" onClick={check} disabled={q.kind === "choice" ? choice === null : input.trim() === ""}>Check</button>
        )}
      </div>
    </section>
  );
}
