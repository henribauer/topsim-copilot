import { useEffect, useRef, useState } from "react";
import { extractCitations, numberCitations, type Citation } from "./copilot/citations";
import { parseMarkdown, type Inline } from "./copilot/markdown";

type Mode = "coach" | "propose";

interface Message {
  role: "user" | "assistant";
  text: string;
  /** Assistant only: citations found in the answer (known = matches a source the copilot was given). */
  citations?: Citation[];
  failed?: boolean;
}

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "coach", label: "Coach", hint: "Explains and asks — you decide" },
  { id: "propose", label: "Propose", hint: "Suggests a full decision set with reasons" },
];

const STARTERS = [
  "Explain how our net income in period 0 came about.",
  "What is contribution margin II, and what is ours?",
  "Where did we use the overdraft, and why does that matter?",
];

/**
 * AI copilot (PRD Must 6). Design guide, section 6: persistent transcript; numbered inline citations that
 * jump to a source list (D25, D26 — Perplexity-style refs 32, 33); the Coach/Propose switch directly above the
 * input (D27, ref 35); a visible "reading the sources" status while waiting (D28); sources listed under every
 * answer (D29). Coach is the default (PRD: learning first).
 */
export function Copilot({ prefill, onPrefillUsed }: { prefill?: string | null; onPrefillUsed?: () => void }) {
  const [mode, setMode] = useState<Mode>("coach");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const end = useRef<HTMLDivElement>(null);

  // A question handed over from the glossary lands in the input; Henri decides whether to send it.
  useEffect(() => {
    if (prefill) {
      setDraft(prefill);
      onPrefillUsed?.();
    }
  }, [prefill, onPrefillUsed]);

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "end" });
  }, [messages, waiting]);

  // D28: the wait is 5–15 s, so show what is happening and for how long.
  useEffect(() => {
    if (!waiting) return;
    setSeconds(0);
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [waiting]);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || waiting) return;
    const next: Message[] = [...messages, { role: "user", text }];
    setMessages(next);
    setDraft("");
    setWaiting(true);
    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Failed answers are not part of the conversation Claude should continue from.
        body: JSON.stringify({ mode, messages: next.filter((m) => !m.failed).map(({ role, text }) => ({ role, text })) }),
      });
      const body = await res.json();
      setMessages([
        ...next,
        body.ok
          ? { role: "assistant", text: body.text, citations: extractCitations(body.text, body.sources) }
          : { role: "assistant", text: body.error, failed: true },
      ]);
    } catch (e) {
      setMessages([
        ...next,
        { role: "assistant", text: `Could not reach the local server: ${e instanceof Error ? e.message : e}`, failed: true },
      ]);
    }
    setWaiting(false);
  }

  return (
    <div className="copilot">
      <div className="transcript" aria-live="polite">
        {messages.length === 0 && (
          <div className="copilot-empty">
            <p className="muted">
              Ask about your numbers, a controlling concept or a decision. Answers use the TOPSIM handbook, your lecture
              notes and every report you imported, and name the source of each number.
            </p>
            <div className="starters">
              {STARTERS.map((s) => (
                <button key={s} className="starter" onClick={() => ask(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <MessageView key={i} index={i} message={m} />
        ))}
        {waiting && (
          <p className="thinking muted" role="status">
            Reading the handbook, lecture notes and reports… {seconds}s
          </p>
        )}
        <div ref={end} />
      </div>

      <div className="composer">
        {/* D27: the mode switch sits right above the input, not in a settings screen. */}
        <div className="mode" role="radiogroup" aria-label="Copilot mode">
          {MODES.map((m) => (
            <button
              key={m.id}
              role="radio"
              aria-checked={mode === m.id}
              className={mode === m.id ? "mode-btn active" : "mode-btn"}
              onClick={() => setMode(m.id)}
              title={m.hint}
            >
              {m.label}
            </button>
          ))}
          <span className="muted mode-hint">{MODES.find((m) => m.id === mode)!.hint}</span>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(draft);
          }}
        >
          <textarea
            aria-label="Ask the copilot"
            placeholder="Ask about a number, a concept or a decision…"
            value={draft}
            rows={2}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(draft);
              }
            }}
          />
          <button className="primary" type="submit" disabled={waiting || draft.trim() === ""}>
            Ask
          </button>
        </form>
      </div>
    </div>
  );
}

function InlineView({ parts, msg }: { parts: Inline[]; msg: number }) {
  return (
    <>
      {parts.map((p, i) =>
        "cite" in p ? (
          <a key={i} className="cite" href={`#src-${msg}-${p.cite}`}>
            {p.cite}
          </a>
        ) : p.bold ? (
          <strong key={i}>{p.text}</strong>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

function MessageView({ message, index }: { message: Message; index: number }) {
  if (message.role === "user") return <div className="msg user">{message.text}</div>;
  if (message.failed) {
    return (
      <div className="error" role="alert">
        <strong>No answer.</strong> {message.text}
      </div>
    );
  }
  const citations = message.citations ?? [];
  const blocks = parseMarkdown(numberCitations(message.text, citations));
  const unknown = citations.filter((c) => !c.known);
  return (
    <div className="msg assistant">
      {blocks.map((b, i) =>
        b.type === "heading" ? (
          <h3 key={i}>
            <InlineView parts={b.inline} msg={index} />
          </h3>
        ) : b.type === "paragraph" ? (
          <p key={i}>
            <InlineView parts={b.inline} msg={index} />
          </p>
        ) : b.ordered ? (
          <ol key={i}>
            {b.items.map((it, j) => (
              <li key={j}>
                <InlineView parts={it} msg={index} />
              </li>
            ))}
          </ol>
        ) : (
          <ul key={i}>
            {b.items.map((it, j) => (
              <li key={j}>
                <InlineView parts={it} msg={index} />
              </li>
            ))}
          </ul>
        ),
      )}
      {citations.length > 0 && (
        // D26 + D29: the sources behind the answer, in their own collapsible block under it.
        <details className="sources">
          <summary>
            {citations.length} source{citations.length === 1 ? "" : "s"}
          </summary>
          <ol>
            {citations.map((c, i) => (
              <li key={c.label} id={`src-${index}-${i + 1}`} className={c.known ? "" : "src-unknown"}>
                {c.label}
                {!c.known && " — not one of the sources I was given; double-check this"}
              </li>
            ))}
          </ol>
        </details>
      )}
      {unknown.length > 0 && (
        // D12: a non-blocking amber note, with the reason in words.
        <div className="warning">
          {unknown.length} citation{unknown.length === 1 ? "" : "s"} point{unknown.length === 1 ? "s" : ""} to a source the copilot
          was not given — verify before relying on it.
        </div>
      )}
    </div>
  );
}
