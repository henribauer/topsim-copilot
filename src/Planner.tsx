import { useEffect, useMemo, useState } from "react";
import { forecast, type Forecast } from "./plan/forecast";
import { missingReports, openingAfter, type Decisions, type Opening } from "./plan/opening";
import { compareScenarios, defaultDecisions, suggestStaff } from "./plan/scenarios";
import { bestScenario, plannerSummary, sliderRange, type NumField as SliderField } from "./plan/summary";
import type { PeriodFile } from "./store/periodStore";

const fmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/**
 * Planner and What-if (PRD Must 4 + 5), redesigned in step 4 (R4; Mobbin: Claude calculator, Quicken, Churnkey, Origin):
 * the outcome stays pinned above the form, decisions sit in labelled cards, every number has a slider with a tick
 * at last period's value. The decision areas follow the Decision Protocol (TNB19) and the manual's
 * chapter 3; every check names its handbook section. The forecast is plan/forecast.ts, which reproduces the real
 * period 0 to the cent; only demand is an estimate and is labelled so. Henri still types the decisions into TOPSIM
 * himself (no automation), so this page ends in a plain list to copy.
 */
interface Loaded {
  opening: Opening;
  last: PeriodFile;
}

function useLoaded(): { loaded: Loaded | null; problem: string | null; loading: boolean } {
  const [periods, setPeriods] = useState<PeriodFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/periods")
      .then((r) => r.json())
      .then((b) => setPeriods(b.periods))
      .catch((e) => setError(String(e)));
  }, []);
  if (error) return { loaded: null, problem: `Could not load the periods. ${error}`, loading: false };
  if (!periods) return { loaded: null, problem: null, loading: true };
  const sorted = [...periods].sort((a, b) => b.period - a.period);
  for (const p of sorted) {
    const o = openingAfter(p);
    if (o) return { loaded: { opening: o, last: p }, problem: null, loading: false };
  }
  if (sorted.length === 0) return { loaded: null, problem: "No period imported yet.", loading: false };
  return {
    loaded: null,
    problem: `Period ${sorted[0].period} is missing reports the plan needs: ${missingReports(sorted[0]).join(", ")}.`,
    loading: false,
  };
}

function Gate({ children }: { children: (l: Loaded) => React.ReactNode }) {
  const { loaded, problem, loading } = useLoaded();
  if (loading) return <p className="muted">Loading…</p>;
  if (!loaded)
    return (
      <div className="card empty">
        <p>{problem} Import the whole report package of the last period and the plan starts from its end state.</p>
      </div>
    );
  return <>{children(loaded)}</>;
}

type NumField = keyof Pick<Decisions, "price" | "advertising" | "advisors" | "qualityIncrease" | "production" | "newLines" | "productionStaff">;

const FIELDS: { key: NumField; label: string; unit: string; step: number; area: string; help: string }[] = [
  { key: "price", label: "Price", unit: "EUR", step: 1, area: "Marketing", help: "Demand falls when the price rises (price table, 3.1.3)." },
  { key: "advertising", label: "Advertising", unit: "TEUR", step: 10, area: "Marketing", help: "Effect has decreasing returns and lasts several periods (3.1.4.1)." },
  { key: "advisors", label: "Customer advisors", unit: "heads", step: 1, area: "Marketing", help: "One more advisor sells about 4.5 % more in the same period (3.1.5)." },
  { key: "qualityIncrease", label: "Quality increase", unit: "levels", step: 1, area: "Product", help: "At most two levels per period, 100 TEUR each (3.2)." },
  { key: "production", label: "Production volume", unit: "units", step: 500, area: "Production", help: "Limited by the lines and by staff incl. 20 % overtime (3.4.2, 3.4.7)." },
  { key: "newLines", label: "New production lines", unit: "lines", step: 1, area: "Production", help: "1,250 TEUR each, 12,000 units, ready at once (3.4.2.1)." },
  { key: "productionStaff", label: "Production staff", unit: "heads", step: 1, area: "Production", help: "2,000 units per employee (3.4.7)." },
];

export function DecisionForm({
  opening,
  last,
  value,
  onChange,
  compact,
}: {
  opening: Opening;
  /** Last period's decisions: where the tick on each slider sits. */
  last: Decisions;
  value: Decisions;
  onChange: (d: Decisions) => void;
  compact?: boolean;
}) {
  const areas = ["Marketing", "Product", "Production"];
  const set = (key: NumField, v: number) => onChange({ ...value, [key]: v });
  return (
    <div className="decision-form">
      {areas.map((area, n) => (
        <fieldset key={area}>
          <legend><span className="step-no">{n + 1}</span>{area}</legend>
          {FIELDS.filter((f) => f.area === area).map((f) => {
            const r = sliderRange(f.key as SliderField, opening, last, value);
            const tick = r.max > r.min ? ((r.reference - r.min) / (r.max - r.min)) * 100 : 0;
            return (
              <div key={f.key} className="field" title={f.help}>
                <label className="fl" htmlFor={`${area}-${f.key}-${compact ? "c" : "p"}`}>{f.label}</label>
                <input
                  id={`${area}-${f.key}-${compact ? "c" : "p"}`}
                  type="number"
                  step={f.step}
                  min={0}
                  value={Number.isNaN(value[f.key]) ? "" : value[f.key]}
                  onChange={(e) => set(f.key, e.target.value === "" ? 0 : Number(e.target.value))}
                />
                <span className="fu">{f.unit}</span>
                <span className="slider" title={`Last period: ${whole.format(r.reference)}`}>
                  <input
                    type="range"
                    aria-label={`${f.label} slider`}
                    min={r.min}
                    max={r.max}
                    step={r.step}
                    value={Math.min(r.max, Math.max(r.min, value[f.key]))}
                    onChange={(e) => set(f.key, Number(e.target.value))}
                  />
                  <i className="tick" style={{ left: `${Math.min(100, Math.max(0, tick))}%` }} aria-hidden />
                </span>
              </div>
            );
          })}
          {area === "Production" && (
            <>
              <div className="field">
                <span className="fl">Scrap lines</span>
                <span className="scrap">
                  {opening.lines.map((l) => (
                    <label key={l.no} className="chk" title={`Net book value ${fmt.format(l.nbv)} TEUR; sold for 25 % of it (3.4.2.2)`}>
                      <input
                        type="checkbox"
                        checked={value.scrapLines.includes(l.no)}
                        onChange={(e) =>
                          onChange({ ...value, scrapLines: e.target.checked ? [...value.scrapLines, l.no].sort() : value.scrapLines.filter((x) => x !== l.no) })
                        }
                      />
                      Line {l.no}
                    </label>
                  ))}
                </span>
              </div>
              <button className="link" onClick={() => onChange({ ...value, productionStaff: suggestStaff(value.production) })}>
                Staff for {whole.format(value.production)} units without overtime: {suggestStaff(value.production)} →
              </button>
            </>
          )}
        </fieldset>
      ))}
    </div>
  );
}

function Money({ v, strong }: { v: number; strong?: boolean }) {
  return <td className={`num${strong ? " strong" : ""}${v < 0 ? " neg" : ""}`}>{fmt.format(v)}</td>;
}

export function Checks({ f }: { f: Forecast }) {
  if (f.checks.length === 0) return <p className="ok-line">✓ Nothing to warn about: lines, staff and cash all cover this plan.</p>;
  return (
    <ul className="checks">
      {f.checks.map((c, i) => (
        <li key={i} className={c.level}>
          <span className="badge">{c.level === "error" ? "Not possible" : c.level === "warn" ? "Watch out" : "Note"}</span>
          {c.text}
          {c.source && <span className="src"> · Handbook §{c.source}</span>}
        </li>
      ))}
    </ul>
  );
}

export function Assumptions({ f }: { f: Forecast }) {
  return (
    <details className="explain">
      <summary>What this forecast rests on</summary>
      <ul>
        <li>Everything except demand is TOPSIM's own bookkeeping, replayed against your real period 0 to the cent.</li>
        {f.assumptions.map((a, i) => (
          <li key={i}>{a}</li>
        ))}
      </ul>
    </details>
  );
}

export function Planner({ onAsk }: { onAsk: (q: string) => void }) {
  return <Gate>{(l) => <PlannerBody loaded={l} onAsk={onAsk} />}</Gate>;
}

/** R4 (Claude calculator, Churnkey): the three numbers that answer "is this plan good?", pinned while Henri edits. */
function ResultsBand({ f, d }: { f: Forecast; d: Decisions }) {
  const sum = plannerSummary(f, d);
  return (
    <div className="results-band" role="region" aria-label="Result of this plan">
      <div className="rb-item">
        <span className="kpi-label">Net income · TEUR</span>
        <span className={`rb-value${sum.netIncome < 0 ? " neg" : ""}`}>{fmt.format(sum.netIncome)}</span>
      </div>
      <div className="rb-item">
        <span className="kpi-label">Overdraft needed · TEUR</span>
        <span className={`rb-value${sum.overdraft > 0 ? " warn" : " good"}`}>{fmt.format(sum.overdraft)}</span>
        <span className="rb-sub">{sum.overdraft > 0 ? "repaid from next period's cash" : "cash covers the plan"}</span>
      </div>
      <div className="rb-item rb-wide">
        <span className="kpi-label">Production used</span>
        <span className="rb-value">{fmt.format(sum.usedPct)} %</span>
        <div className="cap-bar" aria-label={`Production ${whole.format(sum.usedUnits)} of ${whole.format(sum.limitUnits)} possible units`}>
          <div className={`cap-fill ${sum.status}`} style={{ width: `${sum.barPct}%` }} />
        </div>
        <span className="rb-sub">{whole.format(sum.usedUnits)} of {whole.format(sum.limitUnits)} units (lines {whole.format(f.capacity)}, staff incl. overtime)</span>
      </div>
      <div className={`rb-item rb-status ${sum.problems > 0 ? "bad" : "good"}`}>
        {sum.problems > 0 ? `${sum.problems} problem${sum.problems === 1 ? "" : "s"} TOPSIM would not accept` : "✓ Plan is possible"}
      </div>
    </div>
  );
}

function PlannerBody({ loaded, onAsk }: { loaded: Loaded; onAsk: (q: string) => void }) {
  const { opening, last } = loaded;
  const lastDecisions = useMemo(() => defaultDecisions(last, opening), [last, opening]);
  const [d, setD] = useState<Decisions>(lastDecisions);
  const f = useMemo(() => forecast(opening, d), [opening, d]);
  const [tab, setTab] = useState<"checks" | "forecast" | "enter">("checks");
  const notices = f.checks.filter((c) => c.level !== "info").length;

  return (
    <div className="planner">
      <div className="sticky-results">
        <p className="muted plan-sub">
          Plan for period {opening.period}, starting from the end of period {last.period}. Change a decision and the result updates at once.
        </p>
        <ResultsBand f={f} d={d} />
      </div>
      <div className="plan-grid">
        <section className="card a-card">
          <h2>Decisions</h2>
          <DecisionForm opening={opening} last={lastDecisions} value={d} onChange={setD} />
          <button className="link" onClick={() => setD(lastDecisions)}>Reset to last period's decisions</button>
        </section>
        <section className="card a-card plan-detail">
          <div className="tabs an-tabs" role="tablist" aria-label="Plan details">
            <button role="tab" aria-selected={tab === "checks"} className={tab === "checks" ? "tab active" : "tab"} onClick={() => setTab("checks")}>
              Checks{notices > 0 && <span className="count-badge">{notices}</span>}
            </button>
            <button role="tab" aria-selected={tab === "forecast"} className={tab === "forecast" ? "tab active" : "tab"} onClick={() => setTab("forecast")}>Forecast</button>
            <button role="tab" aria-selected={tab === "enter"} className={tab === "enter" ? "tab active" : "tab"} onClick={() => setTab("enter")}>Type into TOPSIM</button>
          </div>
          {tab === "checks" && <Checks f={f} />}
          {tab === "forecast" && (
            <>
              <table className="cost">
                <tbody>
                  <tr><td>Units demanded <span className="muted">(estimate)</span></td><td className="num">{whole.format(f.demand)}</td></tr>
                  <tr><td>Units sold</td><td className="num">{whole.format(f.sold)}</td></tr>
                  <tr className="margin"><td>Revenue (TEUR)</td><Money v={f.revenue} strong /></tr>
                  <tr className="sub"><td>Material expenses</td><Money v={-f.materialExpenses} /></tr>
                  <tr className="sub"><td>Personnel costs</td><Money v={-f.personnel} /></tr>
                  <tr className="sub"><td>Depreciation</td><Money v={-f.depreciation} /></tr>
                  <tr className="sub"><td>Other expenses</td><Money v={-f.otherExpenses} /></tr>
                  <tr className="sub"><td>Change in finished-goods stock + other income</td><Money v={f.stockChange + f.otherIncome} /></tr>
                  <tr className="margin"><td>Operating income</td><Money v={f.operatingIncome} strong /></tr>
                  <tr className="sub"><td>Interest (long-term + overdraft)</td><Money v={-(f.interestLongTerm + f.interestOverdraft)} /></tr>
                  <tr className="sub"><td>Income tax</td><Money v={-f.tax} /></tr>
                  <tr className="margin"><td>Net income</td><Money v={f.netIncome} strong /></tr>
                  <tr><td>Cash balance at year end (TEUR)</td><Money v={f.cashEnd} /></tr>
                </tbody>
              </table>
              <Assumptions f={f} />
            </>
          )}
          {tab === "enter" && (
            <>
              <p className="muted">TOPSIM stays hands-on: these are the values for the decision screens.</p>
              <ol className="steps">
                <li>Price Online-Market Superbass: <strong>{whole.format(d.price)}</strong></li>
                <li>Advertising: <strong>{whole.format(d.advertising)}</strong></li>
                <li>Account Manager Final Workforce: <strong>{whole.format(d.advisors)}</strong></li>
                <li>Product Quality Level Increase: <strong>+{whole.format(d.qualityIncrease)}</strong></li>
                <li>Production Volume: <strong>{whole.format(d.production)}</strong></li>
                <li>Investment (No. of New Lines): <strong>{whole.format(d.newLines)}</strong></li>
                <li>Disinvestment Line No.: <strong>{d.scrapLines.length ? d.scrapLines.join(", ") : "none"}</strong></li>
                <li>Production Staff: <strong>{whole.format(d.productionStaff)}</strong></li>
              </ol>
            </>
          )}
          <button className="link" onClick={() => onAsk(`Here is my plan for period ${opening.period}: price ${d.price}, advertising ${d.advertising}, ${d.advisors} advisors, production ${d.production}, ${d.productionStaff} production staff, ${d.newLines} new lines. The planner forecasts net income ${fmt.format(f.netIncome)} TEUR. What are the risks and what would you check first?`)}>
            Ask the copilot to review this plan →
          </button>
        </section>
      </div>
    </div>
  );
}

export function WhatIf({ onAsk }: { onAsk: (q: string) => void }) {
  return <Gate>{(l) => <WhatIfBody loaded={l} onAsk={onAsk} />}</Gate>;
}

const NAMES = ["A", "B", "C"];

function WhatIfBody({ loaded, onAsk }: { loaded: Loaded; onAsk: (q: string) => void }) {
  const { opening, last } = loaded;
  const base = useMemo(() => defaultDecisions(last, opening), [last, opening]);
  const [scenarios, setScenarios] = useState<Decisions[]>(() => [base, { ...base, price: Math.max(0, base.price - 10) }]);
  const forecasts = useMemo(() => scenarios.map((d) => forecast(opening, d)), [opening, scenarios]);
  const rows = useMemo(() => compareScenarios(forecasts), [forecasts]);
  const best = useMemo(() => bestScenario(forecasts), [forecasts]);
  const set = (i: number, d: Decisions) => setScenarios(scenarios.map((s, j) => (j === i ? d : s)));

  return (
    <div className="whatif">
      <p className="muted">
        Compare up to three plans for period {opening.period}. Scenario A is the reference; the others show their difference to it (green = better for you, red = worse).
      </p>
      <section className="card a-card">
        <h2>Comparison</h2>
        <table className="cost variance">
          <thead>
            <tr><th />{scenarios.map((_, i) => <th key={i} className={`num${best === i ? " best" : ""}`}>Scenario {NAMES[i]}{best === i && <span className="best-tag">best</span>}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className={r.label === "Net income" || r.label === "Operating income" ? "margin" : "sub"}>
                <td>{r.label}{r.unit && r.unit !== "units" && <span className="muted"> {r.unit}</span>}</td>
                {r.values.map((v, i) => (
                  <td key={i} className={`num${best === i ? " best" : ""}`}>
                    {r.unit === "TEUR" ? fmt.format(v) : whole.format(v)}
                    {r.deltas[i] !== null && r.favorable[i] !== null && (
                      <span className={r.favorable[i] ? "fav" : "unfav"}> {(r.deltas[i] as number) > 0 ? "▲" : "▼"} {(r.unit === "TEUR" ? fmt : whole).format(Math.abs(r.deltas[i] as number))}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted hint">Demand is an estimate from the manual's rough rules; the cost side is TOPSIM's own bookkeeping.</p>
        <button className="link" onClick={() => onAsk(`Compare these scenarios for period ${opening.period} and tell me which is safest: ` + scenarios.map((d, i) => `${NAMES[i]}: price ${d.price}, advertising ${d.advertising}, advisors ${d.advisors}, production ${d.production} (forecast net income ${fmt.format(forecasts[i].netIncome)} TEUR)`).join("; "))}>
          Ask the copilot which one is safest →
        </button>
      </section>
      <div className="scenario-grid">
        {scenarios.map((d, i) => (
          <section key={i} className="card a-card scenario">
            <h2>Scenario {NAMES[i]}</h2>
            <DecisionForm opening={opening} last={base} value={d} onChange={(nd) => set(i, nd)} compact />
            <Checks f={forecasts[i]} />
            <div className="actions">
              {i > 0 && <button className="link" onClick={() => set(i, scenarios[0])}>Copy from A</button>}
              {scenarios.length > 2 && i === scenarios.length - 1 && <button className="link" onClick={() => setScenarios(scenarios.slice(0, -1))}>Remove</button>}
            </div>
          </section>
        ))}
        {scenarios.length < 3 && (
          <button className="add-scenario" onClick={() => setScenarios([...scenarios, scenarios[0]])}>+ Add scenario {NAMES[scenarios.length]}</button>
        )}
      </div>
    </div>
  );
}
