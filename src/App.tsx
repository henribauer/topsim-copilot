import { useState } from "react";
import { previewPaste } from "./import/previewPaste";
import { Dashboard } from "./Dashboard";
import type {
  CmStep,
  CmTable,
  ContributionMarginReport,
} from "./parser/contributionMargin";
import type { PnlRow, ProfitAndLossReport } from "./parser/profitAndLoss";
import type {
  BalanceSheetReport,
  BsRow,
  PeriodPair,
} from "./parser/balanceSheet";
import type {
  CostCenterReport,
  CostGroup,
  CostTypeReport,
  CostUnitReport,
  CostUnitStep,
} from "./parser/costAccounting";
import type { SectionedReport } from "./parser/sectionedReport";

/** D1: the app's sections. Import and Dashboard exist so far; the rest are shown but disabled. */
const SECTIONS = [
  "Import",
  "Dashboard",
  "Analysis",
  "Planner",
  "What-if",
  "Copilot",
  "Learn",
  "Glossary",
];
const READY = ["Import", "Dashboard"];

/** D24: the three entry modes as tabs on one panel. Only Paste is built (slice 1c). */
const TABS = [
  { id: "paste", label: "Paste text", ready: true },
  { id: "pdf", label: "Upload PDF", ready: false },
  { id: "manual", label: "Manual entry", ready: false },
];

type SaveState =
  | { status: "idle" | "saving" }
  | { status: "saved" | "error"; message: string };

const fmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function App() {
  const [section, setSection] = useState("Dashboard");
  const [text, setText] = useState("");
  const [showJson, setShowJson] = useState(false);
  const [save, setSave] = useState<SaveState>({ status: "idle" });
  const preview = previewPaste(text);

  async function saveToVault() {
    setSave({ status: "saving" });
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const body = await res.json();
      setSave(
        body.ok
          ? {
              status: "saved",
              message: `Saved ${body.reportCode} to TOPSIM/${body.note}`,
            }
          : { status: "error", message: body.error },
      );
    } catch (e) {
      setSave({
        status: "error",
        message: `Could not reach the local server: ${e instanceof Error ? e.message : e}`,
      });
    }
  }

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="brand">TOPSIM Copilot</div>
        {SECTIONS.map((s) => (
          <button
            key={s}
            className={s === section ? "nav active" : "nav"}
            disabled={!READY.includes(s)}
            onClick={() => setSection(s)}
          >
            {s}
          </button>
        ))}
      </nav>

      {section === "Dashboard" && (
        <main className="page">
          <h1>Dashboard</h1>
          <Dashboard onImport={() => setSection("Import")} />
        </main>
      )}
      {section === "Import" && (
        <main className="page">
          <h1>Import reports</h1>
          <p className="muted">
            Paste the text of any TOPSIM report (TNB01–TNB12, TNB14–TNB16,
            TNB19). The report type is detected from its header.
          </p>

          <div className="card">
            <div className="tabs">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  className={t.id === "paste" ? "tab active" : "tab"}
                  disabled={!t.ready}
                >
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
                onChange={(e) => {
                  setText(e.target.value);
                  setSave({ status: "idle" });
                }}
                spellCheck={false}
              />

              <section className="preview">
                {preview.status === "empty" && (
                  <p className="muted">
                    The parsed report will appear here as soon as you paste.
                  </p>
                )}

                {preview.status === "error" && (
                  <div className="error" role="alert">
                    <strong>Could not read this report.</strong>{" "}
                    {preview.message}
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
                    {preview.kind === "cm" && (
                      <CmReportView report={preview.report} />
                    )}
                    {preview.kind === "pnl" && (
                      <PnlReportView report={preview.report} />
                    )}
                    {preview.kind === "bs" && (
                      <BsReportView report={preview.report} />
                    )}
                    {preview.kind === "costType" && (
                      <CostTypeView report={preview.report} />
                    )}
                    {preview.kind === "costCenter" && (
                      <CostCenterView report={preview.report} />
                    )}
                    {preview.kind === "costUnit" && (
                      <CostUnitView report={preview.report} />
                    )}
                    {preview.kind === "sectioned" && (
                      <SectionedReportView report={preview.report} />
                    )}
                    {/* D23: the result sits right above the primary action. D11: errors as red banner with text. */}
                    {save.status === "error" && (
                      <div className="error" role="alert">
                        <strong>Not saved.</strong> {save.message}
                      </div>
                    )}
                    {save.status === "saved" && (
                      <p className="saved" role="status">
                        ✓ {save.message}
                      </p>
                    )}
                    <div className="actions">
                      {/* D10: the accent colour is for the primary action. */}
                      <button
                        className="primary"
                        onClick={saveToVault}
                        disabled={
                          save.status === "saving" || save.status === "saved"
                        }
                      >
                        {save.status === "saving"
                          ? "Saving…"
                          : save.status === "saved"
                            ? "Saved"
                            : "Save to vault"}
                      </button>
                    </div>
                    <button
                      className="link"
                      onClick={() => setShowJson((v) => !v)}
                    >
                      {showJson ? "Hide" : "Show"} JSON
                    </button>
                    {showJson && (
                      <pre className="json">
                        {JSON.stringify(preview.report, null, 2)}
                      </pre>
                    )}
                  </>
                )}
              </section>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}

/**
 * The ten "list" reports (TNB01–06, 12, 14, 16, 19) share one view: a table per section, as TOPSIM
 * prints them. D6: values right-aligned, tabular figures; "=" rows bold like margins, "−" rows like
 * costs (same classes as the P&L). The unit gets its own column so numbers stay aligned.
 * Values are shown exactly as printed (TOPSIM's own decimals: "41,000" units, "85.42" %), never as 0 when blank.
 */
export function SectionedReportView({ report }: { report: SectionedReport }) {
  return (
    <>
      {report.sections.map((section, s) => {
        const hasUnit = section.rows.some((r) => r.unit);
        const width = Math.max(
          section.columns.length,
          ...section.rows.map((r) => r.values.length),
        );
        return (
          <div key={s}>
            {section.heading && <h2>{section.heading}</h2>}
            <table className="cm">
              {section.columns.length > 0 && (
                <thead>
                  <tr>
                    <th />
                    {hasUnit && <th />}
                    {section.columns.map((c) => (
                      <th key={c} className="num">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {section.rows.map((r, i) => (
                  <tr
                    key={i}
                    className={
                      r.sign === "=" ? "margin" : r.sign === "-" ? "cost" : ""
                    }
                  >
                    <td>
                      {r.sign === "="
                        ? "= "
                        : r.sign === "-"
                          ? "− "
                          : r.sign === "+"
                            ? "+ "
                            : ""}
                      {r.label}
                    </td>
                    {hasUnit && <td className="muted">{r.unit ?? ""}</td>}
                    {Array.from({ length: width }, (_, col) => {
                      const v = r.values[col];
                      return (
                        <td key={col} className="num">
                          {v?.raw ?? ""}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
      {report.footnotes.map((f) => (
        <p key={f} className="muted">
          {f}
        </p>
      ))}
    </>
  );
}

function CmReportView({ report }: { report: ContributionMarginReport }) {
  return (
    <>
      <CmTableView
        title={`Total (${report.unit})`}
        table={{
          unit: report.unit,
          channels: report.channels,
          steps: report.steps,
        }}
      />
      {report.perUnit ? (
        <CmTableView
          title={`Per unit (${report.perUnit.unit})`}
          table={report.perUnit}
        />
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
        const hasPercent = section.rows.some(
          (r) => r.percentOfRevenue !== null,
        );
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
                    <td>
                      {r.sign === "="
                        ? "= "
                        : r.sign === "-"
                          ? "− "
                          : r.sign === "+"
                            ? "+ "
                            : ""}
                      {r.label}
                    </td>
                    <td className="num">{fmt.format(r.value)}</td>
                    {hasPercent && (
                      <td className="num">
                        {r.percentOfRevenue === null
                          ? ""
                          : `${fmt.format(r.percentOfRevenue)} %`}
                      </td>
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
  const balanced =
    assets.current === liabilities.current &&
    assets.previous === liabilities.previous;
  return (
    <>
      <div className="bs-sides">
        <BsSideView title="Assets (TEUR)" rows={report.assets} total={assets} />
        <BsSideView
          title="Equity and Liabilities (TEUR)"
          rows={report.liabilities}
          total={liabilities}
        />
      </div>
      {!balanced && (
        <div className="warning">
          The two sides do not balance — check the paste.
        </div>
      )}
    </>
  );
}

function BsSideView({
  title,
  rows,
  total,
}: {
  title: string;
  rows: BsRow[];
  total: PeriodPair;
}) {
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
              <th key={c} className="num">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.steps.map((s, i) => (
            <tr key={i} className={s.kind}>
              <td>
                {prefix(s)}
                {s.label}
              </td>
              {/* Rows with fewer values (e.g. CM V: Total only) fill the right-most columns. */}
              {Array.from({ length: width }, (_, col) => {
                const v = s.values[col - (width - s.values.length)];
                return (
                  <td key={col} className="num">
                    {v === undefined ? "" : fmt.format(v)}
                  </td>
                );
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

/** TNB07: where the costs came from, split into overhead (→ cost centers) and direct costs (→ product). */
function CostTypeView({ report }: { report: CostTypeReport }) {
  const groups = report.groups.map((g) => ({
    name: g.name,
    rows: g.rows.map((r) => ({
      label: r.label,
      values: [r.total, r.overhead, r.direct],
      note: r.note,
    })),
  }));
  const { total, overhead, direct } = report.total;
  return (
    <CostGridView
      columns={["Total", "Overhead", "Direct"]}
      groups={groups}
      total={[total, overhead, direct]}
    />
  );
}

/** TNB08: the overhead from TNB07, distributed to the cost centers that caused it. */
function CostCenterView({ report }: { report: CostCenterReport }) {
  const groups = report.groups.map((g) => ({
    name: g.name,
    rows: g.rows.map((r) => ({
      label: r.label,
      values: [r.total, ...r.byCenter],
      note: r.note,
    })),
  }));
  return (
    <CostGridView
      columns={["Total", ...report.centers]}
      groups={groups}
      total={[report.total.total, ...report.total.byCenter]}
    />
  );
}

interface GridViewRow {
  label: string;
  values: number[];
  note?: string;
}

/**
 * Shared grid for TNB07/TNB08. D6: amounts right-aligned, tabular figures; group lines
 * bold like the balance-sheet groups, cost types indented below them, total last.
 * TOPSIM's "(*)" footnote is kept as a marker plus a muted line under the table.
 */
function CostGridView({
  columns,
  groups,
  total,
}: {
  columns: string[];
  groups: CostGroup<GridViewRow>[];
  total: number[];
}) {
  const notes = [
    ...new Set(
      groups.flatMap((g) => g.rows.flatMap((r) => (r.note ? [r.note] : []))),
    ),
  ];
  const mark = (note?: string) =>
    note ? ` ${"*".repeat(notes.indexOf(note) + 1)}` : "";
  return (
    <>
      <h2>Costs (TEUR)</h2>
      <table className="cost">
        <thead>
          <tr>
            <th />
            {columns.map((c) => (
              <th key={c} className="num">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => [
            <tr key={g.name} className="margin">
              <td colSpan={columns.length + 1}>{g.name}</td>
            </tr>,
            ...g.rows.map((r) => (
              <tr key={`${g.name}/${r.label}`} className="sub">
                <td>
                  {r.label}
                  {mark(r.note)}
                </td>
                {r.values.map((v, i) => (
                  <td key={i} className="num">
                    {fmt.format(v)}
                  </td>
                ))}
              </tr>
            )),
          ])}
          <tr className="margin total">
            <td>Total</td>
            {total.map((v, i) => (
              <td key={i} className="num">
                {fmt.format(v)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <Footnotes notes={notes} />
    </>
  );
}

/** TNB09: direct costs plus each cost center's overhead, built up step by step to the full cost. */
function CostUnitView({ report }: { report: CostUnitReport }) {
  const notes = [
    ...new Set(report.perUnit.flatMap((s) => (s.note ? [s.note] : []))),
  ];
  return (
    <>
      <CostStepsView
        title="Total (TEUR)"
        columns={["Total", ...report.products]}
        steps={report.totals.map((s) => ({
          ...s,
          values: [s.total, ...s.byProduct],
        }))}
        notes={[]}
      />
      <CostStepsView
        title="Per unit (EUR)"
        columns={report.products}
        steps={report.perUnit.map((s) => ({ ...s, values: s.byProduct }))}
        notes={notes}
      />
      <Footnotes notes={notes} />
    </>
  );
}

function CostStepsView({
  title,
  columns,
  steps,
  notes,
}: {
  title: string;
  columns: string[];
  steps: (CostUnitStep & { values: number[] })[];
  notes: string[];
}) {
  return (
    <>
      <h2>{title}</h2>
      <table className="cost">
        <thead>
          <tr>
            <th />
            {columns.map((c) => (
              <th key={c} className="num">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {steps.map((s, i) => (
            <tr key={i} className={s.sign === "=" ? "margin" : ""}>
              <td>
                {s.sign === "+/-" ? "± " : `${s.sign} `}
                {s.label}
                {s.note ? ` ${"*".repeat(notes.indexOf(s.note) + 1)}` : ""}
              </td>
              {s.values.map((v, j) => (
                <td key={j} className="num">
                  {fmt.format(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Footnotes({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  return (
    <ol className="footnotes muted">
      {notes.map((n, i) => (
        <li key={n}>
          {"*".repeat(i + 1)} {n}
        </li>
      ))}
    </ol>
  );
}
