import { useState } from "react";
import { previewPaste } from "./import/previewPaste";
import type { CmStep, CmTable } from "./parser/contributionMargin";

/** D1: the app's sections. Only Import exists so far; the rest are shown but disabled. */
const SECTIONS = ["Import", "Dashboard", "Analysis", "Planner", "What-if", "Copilot", "Learn", "Glossary"];

/** D24: the three entry modes as tabs on one panel. Only Paste is built (slice 1c). */
const TABS = [
  { id: "paste", label: "Paste text", ready: true },
  { id: "pdf", label: "Upload PDF", ready: false },
  { id: "manual", label: "Manual entry", ready: false },
];

const fmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function App() {
  const [text, setText] = useState("");
  const [showJson, setShowJson] = useState(false);
  const preview = previewPaste(text);

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="brand">TOPSIM Copilot</div>
        {SECTIONS.map((s) => (
          <button key={s} className={s === "Import" ? "nav active" : "nav"} disabled={s !== "Import"}>
            {s}
          </button>
        ))}
      </nav>

      <main className="page">
        <h1>Import reports</h1>
        <p className="muted">
          Paste the text of a TOPSIM report. Supported so far: TNB10 Contribution Margin.
        </p>

        <div className="card">
          <div className="tabs">
            {TABS.map((t) => (
              <button key={t.id} className={t.id === "paste" ? "tab active" : "tab"} disabled={!t.ready}>
                {t.label}
                {!t.ready && <span className="soon">soon</span>}
              </button>
            ))}
          </div>

          <div className="split">
            <textarea
              aria-label="Report text"
              placeholder="Paste the report text here (select all in the PDF, copy, paste)…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
            />

            <section className="preview">
              {preview.status === "empty" && (
                <p className="muted">The parsed report will appear here as soon as you paste.</p>
              )}

              {preview.status === "error" && (
                <div className="error" role="alert">
                  <strong>Could not read this report.</strong> {preview.message}
                </div>
              )}

              {preview.status === "ok" && (
                <>
                  <div className="meta">
                    <span>{preview.report.reportCode}</span>
                    <span>{preview.report.title}</span>
                    <span>Period {preview.report.period}</span>
                    <span>{preview.report.company}</span>
                  </div>
                  <CmTableView
                    title={`Total (${preview.report.unit})`}
                    table={{ unit: preview.report.unit, channels: preview.report.channels, steps: preview.report.steps }}
                  />
                  {preview.report.perUnit ? (
                    <CmTableView title={`Per unit (${preview.report.perUnit.unit})`} table={preview.report.perUnit} />
                  ) : (
                    <div className="warning">Page 2 (per unit) was not in the paste.</div>
                  )}
                  <button className="link" onClick={() => setShowJson((v) => !v)}>
                    {showJson ? "Hide" : "Show"} JSON
                  </button>
                  {showJson && <pre className="json">{JSON.stringify(preview.report, null, 2)}</pre>}
                </>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function CmTableView({ title, table }: { title: string; table: CmTable }) {
  const width = table.channels.length;
  return (
    <>
      <h2>{title}</h2>
      <table>
        <thead>
          <tr>
            <th />
            {table.channels.map((c) => (
              <th key={c} className="num">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.steps.map((s, i) => (
            <tr key={i} className={s.kind}>
              <td>{prefix(s)}{s.label}</td>
              {/* Rows with fewer values (e.g. CM V: Total only) fill the right-most columns. */}
              {Array.from({ length: width }, (_, col) => {
                const v = s.values[col - (width - s.values.length)];
                return <td key={col} className="num">{v === undefined ? "" : fmt.format(v)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function prefix(s: CmStep): string {
  return s.kind === "cost" ? "− " : s.kind === "margin" ? "= " : "";
}
