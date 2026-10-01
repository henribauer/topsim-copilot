import { useState } from "react";
import { ReportPreview } from "./App";
import { importFiles, type ImportItem, type ImportResult } from "./import/importFiles";

type RowSave = { status: "saved" } | { status: "error"; message: string };

type State =
  | { status: "idle" }
  | { status: "reading"; names: string[] }
  | { status: "ready"; result: ImportResult };

/**
 * Upload tab. Design-guide refs: drop zone with a secondary "choose files" button and
 * multi-file support (Docusign 1, Gusto 2, Chatbase 3); a persistent file list with the
 * reviewed report beside it before anything is saved (Chatbase 3, Supabase 4).
 * Everything runs in the browser — the PDFs never leave the Mac.
 */
export function FileImport() {
  const [state, setState] = useState<State>({ status: "idle" });
  const [selected, setSelected] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [saves, setSaves] = useState<Record<number, RowSave>>({});
  const [saving, setSaving] = useState(false);

  async function read(list: FileList | null) {
    if (!list || list.length === 0) return;
    const files = [...list];
    setState({ status: "reading", names: files.map((f) => f.name) });
    setSaves({});
    setSelected(0);
    const dropped = await Promise.all(
      files.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })),
    );
    setState({ status: "ready", result: await importFiles(dropped) });
  }

  async function saveAll(items: ImportItem[]) {
    setSaving(true);
    // One at a time, oldest period first: each save rewrites that period's file in the vault.
    for (const [i, item] of items.entries()) {
      if (item.preview.status !== "ok" || saves[i]?.status === "saved") continue;
      let result: RowSave;
      try {
        const res = await fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: item.text }),
        });
        const body = await res.json();
        result = body.ok ? { status: "saved" } : { status: "error", message: body.error };
      } catch (e) {
        result = { status: "error", message: `Could not reach the local server: ${e instanceof Error ? e.message : e}` };
      }
      setSaves((s) => ({ ...s, [i]: result }));
    }
    setSaving(false);
  }

  const dropZone = (
    <label
      className={dragging ? "dropzone dragging" : "dropzone"}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        read(e.dataTransfer.files);
      }}
    >
      <strong>Drop the reports ZIP or report PDFs here</strong>
      <span className="muted">or click to choose files · several files at once are fine</span>
      <input
        type="file"
        accept=".zip,.pdf,application/zip,application/pdf"
        multiple
        hidden
        onChange={(e) => {
          read(e.target.files);
          e.target.value = "";
        }}
      />
    </label>
  );

  if (state.status === "idle") return <div className="upload">{dropZone}</div>;
  if (state.status === "reading") {
    return (
      <div className="upload">
        <p className="muted" role="status">Reading {state.names.join(", ")}…</p>
      </div>
    );
  }

  const { items, skipped } = state.result;
  const good = items.filter((i) => i.preview.status === "ok");
  const savedCount = Object.values(saves).filter((s) => s.status === "saved").length;
  const failedSaves = Object.values(saves).filter((s) => s.status === "error").length;
  const periods = [...new Set(good.map((i) => i.period))];
  const current = items[selected];

  return (
    <div className="upload">
      {dropZone}
      <p className="muted summary">
        {good.length} report{good.length === 1 ? "" : "s"} found
        {periods.length > 0 && ` for period ${periods.join(", ")}`}
        {items.length > good.length && ` · ${items.length - good.length} file(s) could not be read`}
        {skipped.length > 0 && ` · ${skipped.length} duplicate(s) left out`}
      </p>
      {skipped.length > 0 && (
        // D12: a non-blocking note, amber, with the reason in words (D35).
        <div className="warning">
          {skipped.slice(0, 3).map((s) => (
            <div key={s}>Left out — {s}</div>
          ))}
          {skipped.length > 3 && <div>…and {skipped.length - 3} more duplicates.</div>}
        </div>
      )}

      <div className="split files">
        <ul className="filelist" aria-label="Reports in the upload">
          {items.map((item, i) => {
            const ok = item.preview.status === "ok";
            const save = saves[i];
            return (
              <li key={item.source}>
                <button className={i === selected ? "file active" : "file"} onClick={() => setSelected(i)}>
                  <span className="file-title">
                    {ok && item.preview.status === "ok"
                      ? `${item.code} · ${item.preview.report.title}`
                      : item.source.split(" › ").pop()}
                  </span>
                  <span className="file-meta">
                    {ok ? `Period ${item.period}` : "Not readable"}
                    {save?.status === "saved" && <span className="ok-text"> · ✓ saved</span>}
                    {save?.status === "error" && <span className="err-text"> · not saved</span>}
                    {!ok && <span className="err-text"> · see reason</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <section className="preview">
          <p className="source muted">{current.source}</p>
          {current.preview.status === "ok" ? (
            <ReportPreview preview={current.preview} />
          ) : (
            <div className="error" role="alert">
              <strong>Could not read this file.</strong>{" "}
              {current.preview.status === "error" ? current.preview.message : ""}
            </div>
          )}
          {saves[selected]?.status === "error" && (
            <div className="error" role="alert">
              <strong>Not saved.</strong> {(saves[selected] as { message: string }).message}
            </div>
          )}
        </section>
      </div>

      {/* D23: the result sits right above the primary action. D10: accent only on the primary button. */}
      <div className="actions upload-actions">
        {savedCount > 0 && (
          <p className="saved" role="status">
            ✓ Saved {savedCount} of {good.length} reports to TOPSIM/
            {failedSaves > 0 && ` — ${failedSaves} failed, see the red rows`}
          </p>
        )}
        <button
          className="primary"
          disabled={saving || good.length === 0 || savedCount === good.length}
          onClick={() => saveAll(items)}
        >
          {saving
            ? `Saving ${savedCount + failedSaves + 1} of ${good.length}…`
            : savedCount === good.length && good.length > 0
              ? "All saved"
              : failedSaves > 0
                ? "Retry the failed reports"
                : `Save ${good.length} report${good.length === 1 ? "" : "s"} to vault`}
        </button>
      </div>
    </div>
  );
}
