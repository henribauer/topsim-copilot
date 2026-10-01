import { useState } from "react";
import { previewPaste, type PastePreview } from "./import/previewPaste";
import { FileImport } from "./FileImport";
import { Dashboard } from "./Dashboard";
import { Copilot } from "./Copilot";
import { EditableNum, type FixTarget } from "./Correctable";
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
const READY = ["Import", "Dashboard", "Copilot"];

/** D24: the three entry modes as tabs on one panel. Upload takes the TOPSIM ZIP or single PDFs. */
const TABS = [
  { id: "pdf", label: "Upload PDF or ZIP", ready: true },
  { id: "paste", label: "Paste text", ready: true },
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
  // Set once the pasted report is in the vault: from then on the preview's numbers are fixable.
  const [savedTarget, setSavedTarget] = useState<FixTarget | null>(null);
  const [tab, setTab] = useState("pdf");
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
      if (body.ok) setSavedTarget({ period: body.period, reportCode: body.reportCode });
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
      {section === "Copilot" && (
        <main className="page page-chat">
          <h1>Copilot</h1>
          <Copilot />
        </main>
      )}
      {section === "Import" && (
        <main className="page">
          <h1>Import reports</h1>
          <p className="muted">
            Drop the ZIP from TOPSIM's "download all reports", or single report
            PDFs (TNB01–TNB12, TNB14–TNB16, TNB19). Each report's type and period
            are read from its header.
          </p>

          <div className="card">
            <div className="tabs">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  className={t.id === tab ? "tab active" : "tab"}
                  disabled={!t.ready}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                  {!t.ready && <span className="soon">soon</span>}
                </button>
              ))}
            </div>

            {tab === "pdf" && <FileImport />}
            {tab === "paste" && (
            <div className="split">
              <textarea
                aria-label="Report text"
                placeholder="Paste the report text here (select all in the PDF, copy, paste)…"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setSave({ status: "idle" });
                  setSavedTarget(null);
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
                    <ReportPreview preview={preview} target={savedTarget} />
                    {savedTarget && (
                      // D35: instructions in words, not icons.
                      <p className="muted">
                        Saved — click any number above to fix a value the parser
                        misread; the amber dot marks a fix, ↺ undoes it.
                      </p>
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
            )}
          </div>
        </main>
      )}
    </div>
  );
}

/** Header chips plus the report's own view; used by the Paste tab and the file list.
 * `target` set → numbers are clickable and fixes save to that report (see Correctable.tsx). */
export function ReportPreview({ preview, target }: { preview: Extract<PastePreview, { status: "ok" }>; target?: FixTarget | null }) {
  return (
    <>
      <div className="meta">
        <span>{preview.report.reportCode}</span>
        <span>{preview.report.title}</span>
        <span>Period {preview.report.period}</span>
        <span>{preview.report.company}</span>
      </div>
      {preview.kind === "cm" && (
        <CmReportView report={preview.report} target={target} />
      )}
      {preview.kind === "pnl" && (
        <PnlReportView report={preview.report} target={target} />
      )}
      {preview.kind === "bs" && (
        <BsReportView report={preview.report} target={target} />
      )}
      {preview.kind === "costType" && (
        <CostTypeView report={preview.report} target={target} />
      )}
      {preview.kind === "costCenter" && (
        <CostCenterView report={preview.report} target={target} />
      )}
      {preview.kind === "costUnit" && (
        <CostUnitView report={preview.report} target={target} />
      )}
      {preview.kind === "sectioned" && (
        <SectionedReportView report={preview.report} target={target} />
      )}
    </>
  );
}

/**
 * The ten "list" reports (TNB01–06, 12, 14, 16, 19) share one view: a table per section, as TOPSIM
 * prints them. D6: values right-aligned, tabular figures; "=" rows bold like margins, "−" rows like
 * costs (same classes as the P&L). The unit gets its own column so numbers stay aligned.
 * Values are shown exactly as printed (TOPSIM's own decimals: "41,000" units, "85.42" %), never as 0 when blank.
 */
export function SectionedReportView({ report, target }: { report: SectionedReport; target?: FixTarget | null }) {
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
                      if (!v) return <td key={col} className="num" />;
                      return (
                        <EditableNum
                          key={col}
                          target={target}
                          path={["sections", s, "rows", i, "values", col]}
                          from={v.raw}
                          display={v.raw}
                        />
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

function CmReportView({ report, target }: { report: ContributionMarginReport; target?: FixTarget | null }) {
  return (
    <>
      <CmTableView
        title={`Total (${report.unit})`}
        table={{
          unit: report.unit,
          channels: report.channels,
          steps: report.steps,
        }}
        target={target}
        base={[]}
      />
      {report.perUnit ? (
        <CmTableView
          title={`Per unit (${report.perUnit.unit})`}
          table={report.perUnit}
          target={target}
          base={["perUnit"]}
        />
      ) : (
        <div className="warning">Page 2 (per unit) was not in the paste.</div>
      )}
    </>
  );
}

/** One table per P&L block. D6: amounts right-aligned, tabular figures. */
export function PnlReportView({ report, target }: { report: ProfitAndLossReport; target?: FixTarget | null }) {
  return (
    <>
      {report.sections.map((section, s) => {
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
                    <EditableNum
                      target={target}
                      path={["sections", s, "rows", i, "value"]}
                      from={r.value}
                      display={fmt.format(r.value)}
                    />
                    {hasPercent &&
                      (r.percentOfRevenue === null ? (
                        <td className="num" />
                      ) : (
                        <EditableNum
                          target={target}
                          path={["sections", s, "rows", i, "percentOfRevenue"]}
                          from={r.percentOfRevenue}
                          display={`${fmt.format(r.percentOfRevenue)} %`}
                        />
                      ))}
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
function BsReportView({ report, target }: { report: BalanceSheetReport; target?: FixTarget | null }) {
  const { assets, liabilities } = report.total;
  const balanced =
    assets.current === liabilities.current &&
    assets.previous === liabilities.previous;
  return (
    <>
      <div className="bs-sides">
        <BsSideView target={target} title="Assets (TEUR)" side="assets" rows={report.assets} total={assets} />
        <BsSideView
          target={target}
          title="Equity and Liabilities (TEUR)"
          side="liabilities"
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
  side,
  rows,
  total,
  target,
}: {
  title: string;
  /** Fixes under this side live at ["assets"|"liabilities", row, "current"|"previous"]. */
  side: "assets" | "liabilities";
  rows: BsRow[];
  total: PeriodPair;
  target?: FixTarget | null;
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
          {rows.map((r, i) => (
            <tr key={r.label} className={r.group ? "margin" : "sub"}>
              <td>{r.label}</td>
              <EditableNum target={target} path={[side, i, "current"]} from={r.current} display={fmt.format(r.current)} />
              <EditableNum target={target} path={[side, i, "previous"]} from={r.previous} display={fmt.format(r.previous)} />
            </tr>
          ))}
          <tr className="margin total">
            <td>Balance Sheet Total</td>
            <EditableNum target={target} path={["total", side, "current"]} from={total.current} display={fmt.format(total.current)} />
            <EditableNum target={target} path={["total", side, "previous"]} from={total.previous} display={fmt.format(total.previous)} />
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

function CmTableView({ title, table, target, base }: { title: string; table: CmTable; target?: FixTarget | null; base: (string | number)[] }) {
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
                // Rows with fewer values (e.g. CM V: Total only) fill the right-most columns;
                // the fix path points at the real index inside `values`.
                const idx = col - (width - s.values.length);
                const v = s.values[idx];
                if (v === undefined) return <td key={col} className="num" />;
                return (
                  <EditableNum
                    key={col}
                    target={target}
                    path={[...base, "steps", i, "values", idx]}
                    from={v}
                    display={fmt.format(v)}
                  />
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
function CostTypeView({ report, target }: { report: CostTypeReport; target?: FixTarget | null }) {
  const groups = report.groups.map((g, gi) => ({
    name: g.name,
    rows: g.rows.map((r, ri) => ({
      label: r.label,
      values: [r.total, r.overhead, r.direct],
      paths: [
        ["groups", gi, "rows", ri, "total"],
        ["groups", gi, "rows", ri, "overhead"],
        ["groups", gi, "rows", ri, "direct"],
      ],
      note: r.note,
    })),
  }));
  const { total, overhead, direct } = report.total;
  return (
    <CostGridView
      target={target}
      columns={["Total", "Overhead", "Direct"]}
      groups={groups}
      total={[total, overhead, direct]}
      totalPaths={[["total", "total"], ["total", "overhead"], ["total", "direct"]]}
    />
  );
}

/** TNB08: the overhead from TNB07, distributed to the cost centers that caused it. */
function CostCenterView({ report, target }: { report: CostCenterReport; target?: FixTarget | null }) {
  const groups = report.groups.map((g, gi) => ({
    name: g.name,
    rows: g.rows.map((r, ri) => ({
      label: r.label,
      values: [r.total, ...r.byCenter],
      paths: [
        ["groups", gi, "rows", ri, "total"],
        ...r.byCenter.map((_, ci) => ["groups", gi, "rows", ri, "byCenter", ci]),
      ],
      note: r.note,
    })),
  }));
  return (
    <CostGridView
      target={target}
      columns={["Total", ...report.centers]}
      groups={groups}
      total={[report.total.total, ...report.total.byCenter]}
      totalPaths={[["total", "total"], ...report.total.byCenter.map((_, ci) => ["total", "byCenter", ci])]}
    />
  );
}

interface CostGridRow {
  label: string;
  values: number[];
  /** One fix path per value cell, same order as `values`. */
  paths: (string | number)[][];
  note?: string | null;
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
  totalPaths,
  target,
}: {
  columns: string[];
  groups: { name: string; rows: CostGridRow[] }[];
  total: number[];
  totalPaths: (string | number)[][];
  target?: FixTarget | null;
}) {
  const notes = [
    ...new Set(
      groups.flatMap((g) => g.rows.flatMap((r) => (r.note ? [r.note] : []))),
    ),
  ];
  const mark = (note?: string | null) =>
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
                  <EditableNum
                    key={i}
                    target={target}
                    path={r.paths[i]}
                    from={v}
                    display={fmt.format(v)}
                  />
                ))}
              </tr>
            )),
          ])}
          <tr className="margin total">
            <td>Total</td>
            {total.map((v, i) => (
              <EditableNum
                key={i}
                target={target}
                path={totalPaths[i]}
                from={v}
                display={fmt.format(v)}
              />
            ))}
          </tr>
        </tbody>
      </table>
      <Footnotes notes={notes} />
    </>
  );
}

/** TNB09: direct costs plus each cost center's overhead, built up step by step to the full cost. */
function CostUnitView({ report, target }: { report: CostUnitReport; target?: FixTarget | null }) {
  const notes = [
    ...new Set(report.perUnit.flatMap((s) => (s.note ? [s.note] : []))),
  ];
  return (
    <>
      <CostStepsView
        target={target}
        title="Total (TEUR)"
        columns={["Total", ...report.products]}
        steps={report.totals.map((s, i) => ({
          ...s,
          values: [s.total, ...s.byProduct],
          paths: [["totals", i, "total"], ...s.byProduct.map((_, j) => ["totals", i, "byProduct", j])],
        }))}
        notes={[]}
      />
      <CostStepsView
        target={target}
        title="Per unit (EUR)"
        columns={report.products}
        steps={report.perUnit.map((s, i) => ({
          ...s,
          values: s.byProduct,
          paths: s.byProduct.map((_, j) => ["perUnit", i, "byProduct", j]),
        }))}
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
  target,
}: {
  title: string;
  columns: string[];
  steps: (CostUnitStep & { values: number[]; paths: (string | number)[][] })[];
  notes: string[];
  target?: FixTarget | null;
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
                <EditableNum key={j} target={target} path={s.paths[j]} from={v} display={fmt.format(v)} />
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
