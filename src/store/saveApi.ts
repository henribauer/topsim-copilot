import { basename } from "node:path";
import { saveReport } from "./periodStore";

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
