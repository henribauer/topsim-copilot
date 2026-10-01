import { useEffect, useState } from "react";
import { dashboardKpis, type Kpi } from "./dashboard/kpis";
import type { PeriodFile } from "./store/periodStore";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ok"; periods: PeriodFile[] };

/** D13: KPI dashboard as a grid of small-multiple cards, three per row. Data: GET /api/periods. */
export function Dashboard({ onImport }: { onImport: () => void }) {
  const [load, setLoad] = useState<Load>({ status: "loading" });

  useEffect(() => {
    fetch("/api/periods")
      .then((r) => r.json())
      .then((body) => setLoad({ status: "ok", periods: body.periods }))
      .catch((e) => setLoad({ status: "error", message: `Could not reach the local server: ${e instanceof Error ? e.message : e}` }));
  }, []);

  if (load.status === "loading") return <p className="muted">Loading saved periods…</p>;
  if (load.status === "error")
    return (
      <div className="error" role="alert">
        <strong>Could not load the dashboard.</strong> {load.message}
      </div>
    );

  const withSummary = load.periods.filter((p) => p.reports.TNB01);
  if (withSummary.length === 0)
    return (
      <div className="card empty">
        <p>
          <strong>No Executive Summary saved yet.</strong>
        </p>
        <p className="muted">The dashboard reads its numbers from report TNB01 (Executive Summary). Import it once per period.</p>
        <button className="primary" onClick={onImport}>
          Import a report
        </button>
      </div>
    );

  const latest = withSummary[withSummary.length - 1].period;
  return (
    <>
      <p className="muted">
        Period {latest}
        {withSummary.length > 1 ? ` compared with period ${withSummary[withSummary.length - 2].period}` : " (import the next period to see changes)"}
        . Values exactly as TOPSIM printed them.
      </p>
      <div className="kpi-grid">
        {dashboardKpis(load.periods).map((k) => (
          <KpiCard key={k.label} kpi={k} />
        ))}
      </div>
    </>
  );
}

function KpiCard({ kpi }: { kpi: Kpi }) {
  const last = kpi.points[kpi.points.length - 1];
  return (
    <div className="card kpi">
      {/* D5: small muted label above a large bold numeral. */}
      <div className="kpi-label">
        {kpi.label}
        {kpi.unit && <span className="kpi-unit"> · {kpi.unit}</span>}
      </div>
      <div className="kpi-value">{last ? last.raw : "–"}</div>
      <div className="kpi-foot">
        {kpi.delta && last && <Delta delta={kpi.delta} decimals={decimalsOf(last.raw)} />}
        <Sparkline points={kpi.points.map((p) => p.n)} />
      </div>
    </div>
  );
}

/** D8: green = favourable, red = unfavourable, by meaning (more overdraft is red). */
function Delta({ delta, decimals }: { delta: NonNullable<Kpi["delta"]>; decimals: number }) {
  const cls = delta.favorable === null ? "delta" : delta.favorable ? "delta good" : "delta bad";
  const sign = delta.abs > 0 ? "+" : delta.abs < 0 ? "−" : "±";
  const pct = delta.pct === null ? "" : ` (${sign}${Math.abs(delta.pct).toFixed(2)} %)`;
  return (
    <span className={cls}>
      {sign}
      {Math.abs(delta.abs).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {pct}
    </span>
  );
}

/** The change is printed with as many decimals as TOPSIM printed the value ("6,612.40" → "+612.40"). */
function decimalsOf(raw: string): number {
  return raw.split(".")[1]?.length ?? 0;
}

/** D13: inline sparkline; needs two points to say anything, so it stays empty before period 1. */
function Sparkline({ points }: { points: (number | null)[] }) {
  const ns = points.filter((n): n is number => n !== null);
  if (ns.length < 2) return null;
  const min = Math.min(...ns);
  const span = Math.max(...ns) - min || 1;
  const xy = ns.map((n, i) => `${(i / (ns.length - 1)) * 80},${22 - ((n - min) / span) * 20}`).join(" ");
  return (
    <svg className="spark" width="80" height="24" viewBox="0 0 80 24" aria-hidden="true">
      <polyline points={xy} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
