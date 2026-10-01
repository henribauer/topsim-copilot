import { useState } from "react";
import { previewPaste } from "./import/previewPaste";
import type { CmStep, CmTable, ContributionMarginReport } from "./parser/contributionMargin";
import type { PnlRow, ProfitAndLossReport } from "./parser/profitAndLoss";
import type { BalanceSheetReport, BsRow, PeriodPair } from "./parser/balanceSheet";

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
          Paste the text of a TOPSIM report. Supported so far: TNB10 Contribution Margin, TNB11 Profit and Loss Statement, TNB15 Balance Sheet.
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
                  {preview.kind === "cm" && <CmReportView report={preview.report} />}
                  {preview.kind === "pnl" && <PnlReportView report={preview.report} />}
                  {preview.kind === "bs" && <BsReportView report={preview.report} />}
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

function CmReportView({ report }: { report: ContributionMarginReport }) {
  return (
    <>
      <CmTableView
        title={`Total (${report.unit})`}
        table={{ unit: report.unit, channels: report.channels, steps: report.steps }}
      />
      {report.perUnit ? (
        <CmTableView title={`Per unit (${report.perUnit.unit})`} table={report.perUnit} />
      ) : (
        <div className="warning">Page 2 (per unit) was not in the paste.</div>
      )}
    </>
  );
}

/** One table per P&L block. D6: amounts right-aligned, tabular figures. */
function PnlReportView({ report }: { report: ProfitAndLossReport }) {
  return (
    <>
      {report.sections.map((section) => {
        const hasPercent = section.rows.some((r) => r.percentOfRevenue !== null);
        return (
          <div key={section.title}>
            <h2>{section.title}</h2>
            <table>
              <thead>
                <tr>
                  <th />
                  <th className="num">TEUR</th>
                  {hasPercent && <th className="num">% of Revenue</th>}
                </tr>
              </thead>
              <tbody>
                {section.rows.map((r, i) => (
                  // In a block with a % column, rows without one are the breakdown of the line above
                  // (Wages/Salaries, Hires/Dismissals, Other Staffing Costs under Personnel Costs).
                  <tr key={i} className={pnlRowClass(r, hasPercent)}>
                    <td>{r.sign === "=" ? "= " : r.sign === "-" ? "− " : r.sign === "+" ? "+ " : ""}{r.label}</td>
                    <td className="num">{fmt.format(r.value)}</td>
                    {hasPercent && (
                      <td className="num">{r.percentOfRevenue === null ? "" : `${fmt.format(r.percentOfRevenue)} %`}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </>
  );
}

/**
 * The two sides next to each other, as TOPSIM prints them. D6: amounts right-aligned,
 * tabular figures; group lines bold like margin rows; items indented like P&L sub-rows.
 * D12 amber notice if the two totals differ (a parse or report problem, never normal).
 */
function BsReportView({ report }: { report: BalanceSheetReport }) {
  const { assets, liabilities } = report.total;
  const balanced = assets.current === liabilities.current && assets.previous === liabilities.previous;
  return (
    <>
      <div className="bs-sides">
        <BsSideView title="Assets (TEUR)" rows={report.assets} total={assets} />
        <BsSideView title="Equity and Liabilities (TEUR)" rows={report.liabilities} total={liabilities} />
      </div>
      {!balanced && <div className="warning">The two sides do not balance — check the paste.</div>}
    </>
  );
}

function BsSideView({ title, rows, total }: { title: string; rows: BsRow[]; total: PeriodPair }) {
  return (
    <div>
      <h2>{title}</h2>
      <table>
        <thead>
          <tr>
            <th />
            <th className="num">Current</th>
            <th className="num">Previous</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className={r.group ? "margin" : "sub"}>
              <td>{r.label}</td>
              <td className="num">{fmt.format(r.current)}</td>
              <td className="num">{fmt.format(r.previous)}</td>
            </tr>
          ))}
          <tr className="margin total">
            <td>Balance Sheet Total</td>
            <td className="num">{fmt.format(total.current)}</td>
            <td className="num">{fmt.format(total.previous)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function pnlRowClass(r: PnlRow, hasPercent: boolean): string {
  if (r.sign === "=") return "margin";
  if (hasPercent && r.percentOfRevenue === null) return "sub";
  return r.sign === "-" ? "cost" : "";
}

function CmTableView({ title, table }: { title: string; table: CmTable }) {
  const width = table.channels.length;
  return (
    <>
      <h2>{title}</h2>
      <table className="cm">
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
