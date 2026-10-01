import { useEffect, useState } from "react";
import { breakEven, cmCascade, competitorTable, costPerUnit, periodChange } from "./analysis/analysis";
import { explainBreakEven, explainCmStep, waterfall, type Bar } from "./analysis/explain";
import { analysisHeadlines, analysisTabs, type TabId } from "./analysis/overview";
import type { PeriodFile } from "./store/periodStore";

const fmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/**
 * Analysis (PRD Must 3 + 7), redesigned in step 3 (R3; Mobbin: Vercel, Mintlify, Calendly, Squarespace): three headline
 * numbers first, then a tab bar so only one topic is on screen at a time. Design guide: a real floating-bar waterfall for the contribution-margin cascade with
 * Increase/Decrease/Total legend and dashed connectors (D14, Zoho CRM ref 16); a variance table with direction
 * arrow, delta and green/red meaning (D15, D8, Xero ref 12). Every result has an "Explain" view with the formula
 * and this period's numbers (PRD Must 7). All numbers come from GET /api/periods, fixes included.
 */
export function Analysis({ onAsk, onImport }: { onAsk: (q: string) => void; onImport: () => void }) {
  const [periods, setPeriods] = useState<PeriodFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [tab, setTab] = useState<TabId>("cascade");

  useEffect(() => {
    fetch("/api/periods")
      .then((r) => r.json())
      .then((b) => setPeriods(b.periods))
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <div className="error" role="alert"><strong>Could not load the periods.</strong> {error}</div>;
  if (!periods) return <p className="muted">Loading…</p>;
  const withCm = periods.filter((p) => cmCascade(p)).sort((a, b) => a.period - b.period);
  if (withCm.length === 0) {
    return (
      <div className="card empty">
        <p>
          The analysis starts from the Contribution Margin report (TNB10). Import a period to see the cascade, the cost
          per unit and the break-even point.
        </p>
        <button className="primary" onClick={onImport}>Import reports</button>
      </div>
    );
  }
  const period = withCm.find((p) => p.period === selected) ?? withCm[withCm.length - 1];
  const head = analysisHeadlines(period)!;
  const tabs = analysisTabs(periods, period);
  // A tab that disappears for another period (e.g. "Period vs period" for period 0) must not leave the page blank.
  const current = tabs.find((t) => t.id === tab)?.id ?? tabs[0].id;

  return (
    <div className="analysis">
      <div className="an-top">
        {withCm.length > 1 ? (
          <div className="period-pick" role="tablist" aria-label="Period">
            {withCm.map((p) => (
              <button key={p.period} role="tab" aria-selected={p.period === period.period}
                className={p.period === period.period ? "tab active" : "tab"} onClick={() => setSelected(p.period)}>
                Period {p.period}
              </button>
            ))}
          </div>
        ) : (
          <span className="muted an-period">Period {period.period}</span>
        )}
      </div>

      {/* Calendly / Squarespace: the headline numbers bound together in one row above everything else. */}
      <div className="headline-row">
        <button className="card headline" onClick={() => setTab("cascade")} aria-label="Show the margin cascade">
          <span className="kpi-label">{head.operatingResult.label} · {head.operatingResult.sublabel}</span>
          <span className="headline-value">{fmt.format(head.operatingResult.value)} <small>{head.operatingResult.unit}</small></span>
        </button>
        {head.breakEven && (
          <button className="card headline" onClick={() => setTab("breakeven")} aria-label="Show the break-even point">
            <span className="kpi-label">Break-even point</span>
            <span className="headline-value">{whole.format(head.breakEven.units)} <small>units</small></span>
            <span className="headline-sub">{whole.format(head.breakEven.safetyUnits)} units beyond it · {fmt.format(head.breakEven.safetyPct)} % safety</span>
          </button>
        )}
        {head.costPerUnit && (
          <button className="card headline" onClick={() => setTab("cost")} aria-label="Show the cost per unit">
            <span className="kpi-label">Cost per unit sold</span>
            <span className="headline-value">{fmt.format(head.costPerUnit.value)} <small>{head.costPerUnit.unit}</small></span>
          </button>
        )}
      </div>

      <div className="tabs an-tabs" role="tablist" aria-label="Analysis topic">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={t.id === current} className={t.id === current ? "tab active" : "tab"} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {current === "cascade" && <CascadeCard period={period} onAsk={onAsk} />}
      {current === "breakeven" && <BreakEvenCard period={period} onAsk={onAsk} />}
      {current === "cost" && <CostCard period={period} />}
      {current === "change" && <ChangeCard periods={periods.filter((p) => p.period <= period.period)} />}
      {current === "competitors" && <CompetitorCard period={period} />}
    </div>
  );
}

function Explain({ children, label = "Explain" }: { children: React.ReactNode; label?: string }) {
  return (
    <details className="explain">
      <summary>{label}</summary>
      {children}
    </details>
  );
}

function CascadeCard({ period, onAsk }: { period: PeriodFile; onAsk: (q: string) => void }) {
  const cascade = cmCascade(period)!;
  const bars = waterfall(cascade);
  const [open, setOpen] = useState<string | null>(null);
  const explained = open ? explainCmStep(cascade, open) : null;
  return (
    <section className="card a-card">
      <h2>Contribution margin cascade · Period {period.period}</h2>
      <p className="muted">How revenue becomes the operating result, step by step ({cascade.unit}).</p>
      <Waterfall bars={bars} onPick={(l) => setOpen(l === open ? null : l)} open={open} />
      <div className="legend" aria-hidden>
        <span><i className="sw inc" />Increase</span>
        <span><i className="sw dec" />Decrease</span>
        <span><i className="sw tot" />Total</span>
      </div>
      <p className="muted hint">Click a contribution margin bar to see how it is calculated.</p>
      {explained && (
        <div className="explain-open">
          <h3>{explained.title}</h3>
          <p>{explained.concept}</p>
          <p className="formula">{explained.formula}</p>
          <p className="formula">{explained.worked}</p>
          {explained.note && <div className="warning">{explained.note}</div>}
          <button className="link" onClick={() => onAsk(`Explain ${explained.title} for period ${period.period} using our numbers.`)}>
            Ask the copilot about this →
          </button>
        </div>
      )}
    </section>
  );
}

/** D14: floating bars with dashed connectors. Plain SVG; y runs from the lowest to the highest level. */
function Waterfall({ bars, onPick, open }: { bars: Bar[]; onPick: (label: string) => void; open: string | null }) {
  const W = 940, H = 330, left = 52, bottom = 96, top = 14;
  const max = Math.max(...bars.map((b) => Math.max(b.from, b.to)), 1);
  const min = Math.min(0, ...bars.map((b) => Math.min(b.from, b.to)));
  const y = (v: number) => top + (1 - (v - min) / (max - min)) * (H - top - bottom);
  const step = (W - left) / bars.length;
  const bw = Math.min(40, step * 0.62);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => min + f * (max - min));
  return (
    <svg className="waterfall" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Contribution margin waterfall">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={W} y1={y(t)} y2={y(t)} className="grid" />
          <text x={left - 6} y={y(t) + 4} className="axis" textAnchor="end">{whole.format(t)}</text>
        </g>
      ))}
      {bars.map((b, i) => {
        const x = left + i * step + (step - bw) / 2;
        const hi = Math.max(b.from, b.to), lo = Math.min(b.from, b.to);
        const clickable = b.type === "total";
        return (
          <g key={b.label} className={`bar ${b.type}${clickable ? " pick" : ""}${open === b.label ? " open" : ""}`}
            onClick={clickable ? () => onPick(b.label) : undefined}>
            {i > 0 && (
              <line x1={x - (step - bw)} x2={x} y1={y(b.connectFrom)} y2={y(b.connectFrom)} className="connector" />
            )}
            <rect x={x} y={y(hi)} width={bw} height={Math.max(1, y(lo) - y(hi))} rx={2} />
            <text x={x + bw / 2} y={y(hi) - 4} className="value" textAnchor="middle">{whole.format(b.value)}</text>
            <text transform={`translate(${x + bw / 2},${H - bottom + 10}) rotate(-40)`} className="axis" textAnchor="end">
              {b.label.replace("Contribution Margin", "CM").replace(" Costs", "")}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function BreakEvenCard({ period, onAsk }: { period: PeriodFile; onAsk: (q: string) => void }) {
  const b = breakEven(period);
  if (!b) {
    return (
      <section className="card a-card">
        <h2>Break-even point</h2>
        <p className="muted">Needs a positive contribution margin per unit in the Contribution Margin report; this period has none.</p>
      </section>
    );
  }
  const e = explainBreakEven(b);
  const pctSold = Math.min(100, (b.breakEvenUnits / b.unitsSold) * 100);
  return (
    <section className="card a-card">
      <h2>Break-even point · Period {period.period}</h2>
      <p className="be-line">
        Fixed costs are covered after <strong>{whole.format(b.breakEvenUnits)}</strong> of the <strong>{whole.format(b.unitsSold)}</strong> units sold; the last{" "}
        <strong>{whole.format(b.safetyUnits)}</strong> units are profit ({fmt.format(b.safetyPct)} % margin of safety).
      </p>
      <div className="be-bar" aria-label={`Break-even at ${fmt.format(pctSold)} % of the ${whole.format(b.unitsSold)} units sold`}>
        <div className="be-cover" style={{ width: `${pctSold}%` }} />
      </div>
      <p className="muted hint">Red: the units needed to cover the fixed costs. Green: the units sold beyond that, which add to profit.</p>
      <Explain>
        <p>{e.concept}</p>
        <p className="formula">{e.formula}</p>
        <ol className="steps">
          {e.lines.map((l) => (
            <li key={l.label}>
              <strong>{l.label}</strong> <span className="muted">({l.formula})</span>
              <div className="formula">{l.worked}</div>
            </li>
          ))}
        </ol>
        <button className="link" onClick={() => onAsk(`Explain the break-even point for period ${period.period} using our numbers.`)}>
          Ask the copilot about this →
        </button>
      </Explain>
    </section>
  );
}

function CostCard({ period }: { period: PeriodFile }) {
  const steps = costPerUnit(period);
  if (!steps) return null;
  return (
    <section className="card a-card">
      <h2>Cost per unit · Period {period.period}</h2>
      <p className="muted">Cost Unit Accounting (TNB09), EUR per headphone sold.</p>
      <table className="cost">
        <tbody>
          {steps.map((s) => (
            <tr key={s.label} className={s.sign === "=" ? "margin" : "sub"}>
              <td>{s.sign === "+/-" ? "± " : `${s.sign} `}{s.label}</td>
              <td className="num">{fmt.format(s.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Explain>
        <p>
          Cost unit accounting answers “what did the costs create?”: the cost of one headphone, built up from material and
          production (cost of goods manufactured), then R&amp;D, sales and administration (script p. 27, handbook 3.5.7).
          Direct costs are allocated to the unit directly; overhead is spread over the cost centers first.
        </p>
      </Explain>
    </section>
  );
}

function ChangeCard({ periods }: { periods: PeriodFile[] }) {
  const v = periodChange(periods);
  return (
    <section className="card a-card">
      <h2>Period vs period</h2>
      {!v ? (
        <p className="muted">Needs two imported periods. Import the next period and this table compares it with the one before.</p>
      ) : (
        <>
          <p className="muted">Period {v.latestPeriod} against period {v.previousPeriod}, every contribution margin step (TEUR).</p>
          <table className="cost variance">
            <thead>
              <tr><th /><th className="num">Period {v.previousPeriod}</th><th className="num">Period {v.latestPeriod}</th><th className="num">Change</th><th className="num">%</th></tr>
            </thead>
            <tbody>
              {v.rows.map((r) => (
                <tr key={r.label} className={r.kind === "margin" ? "margin" : "sub"}>
                  <td>{r.label}</td>
                  <td className="num">{fmt.format(r.previous)}</td>
                  <td className="num">{fmt.format(r.latest)}</td>
                  <td className={`num ${r.favorable === null ? "" : r.favorable ? "fav" : "unfav"}`}>
                    {r.abs === 0 ? "–" : `${r.abs > 0 ? "▲" : "▼"} ${fmt.format(Math.abs(r.abs))}`}
                  </td>
                  <td className={`num ${r.favorable === null ? "" : r.favorable ? "fav" : "unfav"}`}>
                    {r.pct === null ? "" : `${fmt.format(Math.abs(r.pct))} %`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted hint">Green = better for the result (more revenue or margin, lower costs), red = worse.</p>
        </>
      )}
    </section>
  );
}

function CompetitorCard({ period }: { period: PeriodFile }) {
  const t = competitorTable(period);
  if (!t) return null;
  return (
    <section className="card a-card">
      <h2>Competitors · Period {period.period}</h2>
      <p className="muted">{t.heading} (Market Research, TNB02). Your company is highlighted.</p>
      <table className="cost">
        <thead>
          <tr><th />{t.columns.map((c, i) => <th key={c} className={`num${i === t.ourColumn ? " ours" : ""}`}>{c}{i === t.ourColumn ? " (you)" : ""}</th>)}</tr>
        </thead>
        <tbody>
          {t.rows.map((r) => (
            <tr key={r.label}>
              <td>{r.label}{r.unit ? <span className="muted"> {r.unit}</span> : null}</td>
              {r.values.map((v, i) => <td key={i} className={`num${i === t.ourColumn ? " ours" : ""}`}>{v.raw}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
