import { basename } from "node:path";
import { loadPeriods, removeCorrection, saveCorrection, saveReport } from "./periodStore";
import { applyCorrections, type Correction } from "./corrections";

export interface ApiResponse {
  status: number;
  body: Record<string, unknown>;
}

/**
 * POST /api/reports, body {text}. Kept free of HTTP plumbing so it is unit-tested; vite.config.ts mounts it.
 * Only the app's own page may save: any website open in the browser could otherwise post to localhost.
 */
export function handleSaveRequest(vaultDir: string, rawBody: string, origin: string | undefined): ApiResponse {
  if (origin !== undefined && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
    return { status: 403, body: { ok: false, error: "Saving is only allowed from the app itself" } };
  }
  let text: unknown;
  try {
    text = (JSON.parse(rawBody) as { text?: unknown }).text;
  } catch {
    return { status: 400, body: { ok: false, error: "Body must be JSON: {\"text\": \"…\"}" } };
  }
  if (typeof text !== "string") return { status: 400, body: { ok: false, error: "Body must be JSON: {\"text\": \"…\"}" } };
  try {
    const r = saveReport(vaultDir, text);
    return { status: 200, body: { ok: true, period: r.period, reportCode: r.reportCode, note: basename(r.notePath) } };
  } catch (e) {
    return { status: 400, body: { ok: false, error: e instanceof Error ? e.message : String(e) } };
  }
}

/**
 * GET /api/periods: everything the dashboard and analysis need. The raw text stays on disk (it is only for
 * re-parsing). `parsed` is already corrected with Henri's fixes, so every screen shows the same numbers;
 * a fix that no longer matches what the parser reads is left out and listed in `stale`.
 */
export function handlePeriodsRequest(vaultDir: string): ApiResponse {
  const periods = loadPeriods(vaultDir).map((p) => ({
    ...p,
    reports: Object.fromEntries(
      Object.entries(p.reports).map(([code, { raw: _raw, parsed, corrections, ...rest }]) => {
        const fixed = applyCorrections(parsed, corrections ?? []);
        return [code, { ...rest, parsed: fixed.report, corrections, stale: fixed.stale }];
      }),
    ),
  }));
  return { status: 200, body: { periods } };
}

/** POST /api/corrections, body {period, reportCode, correction:{path, from, to}}. `at` is set here, not by the browser. */
export function handleCorrectionRequest(vaultDir: string, rawBody: string, origin: string | undefined): ApiResponse {
  if (origin !== undefined && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
    return { status: 403, body: { ok: false, error: "Saving is only allowed from the app itself" } };
  }
  let body: { period?: unknown; reportCode?: unknown; correction?: unknown };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { ok: false, error: 'Body must be JSON: {"period": 0, "reportCode": "TNB10", "correction": {"path": […], "from": …, "to": "6,100.00"}}' } };
  }
  const c = body.correction as Correction | undefined;
  if (typeof body.period !== "number" || typeof body.reportCode !== "string" || !Array.isArray(c?.path) || typeof c.to !== "string") {
    return { status: 400, body: { ok: false, error: 'Body must be JSON: {"period": 0, "reportCode": "TNB10", "correction": {"path": […], "from": …, "to": "6,100.00"}}' } };
  }
  try {
    saveCorrection(vaultDir, body.period, body.reportCode, { path: c.path, from: c.from as Correction["from"], to: c.to, at: new Date().toISOString() });
    return { status: 200, body: { ok: true } };
  } catch (e) {
    console.error("CORR-ERR", e);
    return { status: 400, body: { ok: false, error: `No saved report ${body.reportCode} in period ${body.period}` } };
  }
}

/** DELETE /api/corrections, body {period, reportCode, path} — undo one cell's fix. */
export function handleCorrectionDelete(vaultDir: string, rawBody: string, origin: string | undefined): ApiResponse {
  if (origin !== undefined && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
    return { status: 403, body: { ok: false, error: "Saving is only allowed from the app itself" } };
  }
  let body: { period?: unknown; reportCode?: unknown; path?: unknown };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { ok: false, error: 'Body must be JSON: {"period": 0, "reportCode": "TNB10", "path": […]}' } };
  }
  if (typeof body.period !== "number" || typeof body.reportCode !== "string" || !Array.isArray(body.path)) {
    return { status: 400, body: { ok: false, error: 'Body must be JSON: {"period": 0, "reportCode": "TNB10", "path": […]}' } };
  }
  try {
    removeCorrection(vaultDir, body.period, body.reportCode, body.path as Correction["path"]);
    return { status: 200, body: { ok: true } };
  } catch {
    return { status: 400, body: { ok: false, error: `No saved report ${body.reportCode} in period ${body.period}` } };
  }
}
