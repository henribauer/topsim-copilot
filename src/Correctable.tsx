import { useEffect, useRef, useState } from "react";

/** Where a fixable report lives in the vault; cells are only editable once it is saved. */
export interface FixTarget {
  period: number;
  reportCode: string;
}

/** POSTs one fix; returns null on success, an error message for the cell otherwise. */
export async function apiFix(
  target: FixTarget,
  path: (string | number)[],
  from: number | string,
  to: string,
): Promise<string | null> {
  try {
    const res = await fetch("/api/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period: target.period, reportCode: target.reportCode, correction: { path, from, to } }),
    });
    if (res.ok) return null;
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return body.error ?? `Saving the fix failed (${res.status})`;
  } catch (e) {
    return `Could not reach the local server: ${e instanceof Error ? e.message : e}`;
  }
}

/** DELETEs one fix (undo). Returns null on success, an error message otherwise. */
export async function apiUndo(target: FixTarget, path: (string | number)[]): Promise<string | null> {
  try {
    const res = await fetch("/api/corrections", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period: target.period, reportCode: target.reportCode, path }),
    });
    if (res.ok) return null;
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return body.error ?? `Undo failed (${res.status})`;
  } catch (e) {
    return `Could not reach the local server: ${e instanceof Error ? e.message : e}`;
  }
}

/**
 * One number cell Henri can fix (PRD Must 1: "manual correction screen for any value the parser
 * misses"). Click → type the right value → Enter (or click away). D17 (Melio 5, Twenty 6): a fixed
 * cell keeps showing what Henri typed, with an amber dot saying the parse was overridden — the
 * parsed value is never overwritten (fixes live beside it, see store/corrections.ts). ↺ undoes.
 */
export function EditableNum({
  target,
  path,
  from,
  display,
  extraClass,
}: {
  /** null/undefined → the report is not saved yet, so a fix has nowhere to go: plain cell. */
  target: FixTarget | null | undefined;
  path: (string | number)[];
  /** What the parser reads here right now — the fix must match it, or it is reported stale. */
  from: number | string;
  display: string;
  extraClass?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [fixed, setFixed] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  const cls = extraClass ? `num ${extraClass}` : "num";
  if (!target) return <td className={cls}>{display}</td>;

  if (editing) {
    return (
      <td className={cls}>
        <input
          ref={input}
          className="fix-input"
          defaultValue={fixed ?? display}
          inputMode="decimal"
          disabled={busy}
          aria-label={`Fix ${path.join(".")} — currently ${fixed ?? display}`}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit((e.target as HTMLInputElement).value.trim());
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={(e) => commit(e.target.value.trim())}
        />
      </td>
    );
  }

  return (
    <td
      className={cls + " fixable"}
      title={fixed ? `Fixed — the parser read ${display}` : "Click to fix this number"}
      onClick={() => {
        if (!fixed) setErr(null);
        setEditing(true);
      }}
    >
      {fixed ?? display}
      {fixed && <span className="fix-dot" aria-label="fixed" />}
      {fixed && (
        <button
          className="fix-undo"
          title="Undo — show the parsed value again"
          onClick={(e) => {
            e.stopPropagation();
            setBusy(true);
            apiUndo(target, path).then((msg) => {
              setBusy(false);
              if (msg) setErr(msg);
              else setFixed(null);
            });
          }}
        >
          ↺
        </button>
      )}
      {err && <span className="err-text">{err}</span>}
    </td>
  );

  async function commit(value: string) {
    if (busy) return;
    if (value === "" || value === (fixed ?? display)) {
      setEditing(false);
      return;
    }
    setBusy(true);
    const msg = await apiFix(target!, path, from, value);
    setBusy(false);
    if (msg) {
      setErr(msg);
      return;
    }
    setFixed(value);
    setErr(null);
    setEditing(false);
  }
}
