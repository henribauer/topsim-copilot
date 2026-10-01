import { useEffect, useMemo, useState } from "react";
import { RULES } from "./plan/constants";
import { forecast, type Forecast } from "./plan/forecast";
import { missingReports, openingAfter, type Decisions, type Opening } from "./plan/opening";
import { compareScenarios, defaultDecisions, suggestStaff } from "./plan/scenarios";
import type { PeriodFile } from "./store/periodStore";

const fmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/**
 * Planner and What-if (PRD Must 4 + 5). The decision areas follow the Decision Protocol (TNB19) and the manual's
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

export function DecisionForm({ opening, value, onChange }: { opening: Opening; value: Decisions; onChange: (d: Decisions) => void }) {
  const areas = ["Marketing", "Product", "Production"];
  const hint = (f: (typeof FIELDS)[number]) => {
    const was = f.key === "qualityIncrease" ? null : f.key === "production" ? null : f.key === "newLines" ? null : f.key === "productionStaff" ? opening.workforce.production : (opening as unknown as Record<string, number>)[f.key];
    return was === null ? "" : `was ${whole.format(was)}`;
  };
  return (
    <div className="decision-form">
      {areas.map((area) => (
        <fieldset key={area}>
          <legend>{area}</legend>
          {FIELDS.filter((f) => f.area === area).map((f) => (
            <label key={f.key} className="field" title={f.help}>
              <span className="fl">{f.label}</span>
              <input
                type="number"
                step={f.step}
                min={0}
                value={Number.isNaN(value[f.key]) ? "" : value[f.key]}
                onChange={(e) => onChange({ ...value, [f.key]: e.target.value === "" ? 0 : Number(e.target.value) })}
              />
              <span className="fu">{f.unit}</span>
              <span className="fh muted">{hint(f)}</span>
            </label>
          ))}
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
                          onChange({ ...value, scrapLines: e.target.checked ? [...value.scrapLines, l.no].sort() : value.scrapLines.filter((n) => n !== l.no) })
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

function PlannerBody({ loaded, onAsk }: { loaded: Loaded; onAsk: (q: string) => void }) {
  const { opening, last } = loaded;
  const [d, setD] = useState<Decisions>(() => defaultDecisions(last, opening));
  const f = useMemo(() => forecast(opening, d), [opening, d]);
  const errors = f.checks.filter((c) => c.level === "error").length;
  const staffMax = Math.floor(d.productionStaff * RULES.unitsPerEmployee.value * (1 + RULES.maxOvertime.value));
  const limit = Math.min(f.capacity, staffMax);
  const pct = limit > 0 ? Math.min(100, (d.production / limit) * 100) : 0;

  return (
    <div className="planner">
      <p className="muted">
        Plan for period {opening.period}, starting from the end of period {last.period}. Change a decision and the checks and numbers update at once.
      </p>
      <div className="plan-grid">
        <section className="card a-card">
          <h2>Decisions</h2>
          <DecisionForm opening={opening} value={d} onChange={setD} />
          <button className="link" onClick={() => setD(defaultDecisions(last, opening))}>Reset to last period's decisions</button>
        </section>
        <div className="plan-right">
          <section className="card a-card">
            <h2>Checks</h2>
            <Checks f={f} />
            <div className="cap" aria-label={`Production ${whole.format(d.production)} of ${whole.format(limit)} possible units`}>
              <div className="cap-bar"><div className={`cap-fill${pct >= 100 ? " full" : ""}`} style={{ width: `${pct}%` }} /></div>
              <span className="muted">{whole.format(d.production)} planned of {whole.format(limit)} possible ({whole.format(f.capacity)} by the lines, {whole.format(staffMax)} by staff with overtime)</span>
            </div>
          </section>
          <section className="card a-card">
            <h2>Forecast</h2>
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
                <tr><td>Overdraft needed at year end (TEUR)</td><Money v={f.overdraft} /></tr>
                <tr><td>Cash balance at year end (TEUR)</td><Money v={f.cashEnd} /></tr>
              </tbody>
            </table>
            <Assumptions f={f} />
          </section>
          <section className="card a-card">
            <h2>Type into TOPSIM</h2>
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
            {errors > 0 && <div className="warning">This plan has {errors} problem{errors === 1 ? "" : "s"} TOPSIM would not accept as it is.</div>}
            <button className="link" onClick={() => onAsk(`Here is my plan for period ${opening.period}: price ${d.price}, advertising ${d.advertising}, ${d.advisors} advisors, production ${d.production}, ${d.productionStaff} production staff, ${d.newLines} new lines. The planner forecasts net income ${fmt.format(f.netIncome)} TEUR. What are the risks and what would you check first?`)}>
              Ask the copilot to review this plan →
            </button>
          </section>
        </div>
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
            <tr><th />{scenarios.map((_, i) => <th key={i} className="num">Scenario {NAMES[i]}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className={r.label === "Net income" || r.label === "Operating income" ? "margin" : "sub"}>
                <td>{r.label}{r.unit && r.unit !== "units" && <span className="muted"> {r.unit}</span>}</td>
                {r.values.map((v, i) => (
                  <td key={i} className="num">
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
            <DecisionForm opening={opening} value={d} onChange={(nd) => set(i, nd)} />
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
