import { handleCopilotRequest, type CopilotConfig } from "../copilot/copilotApi";
import { spawnClaude, type Spawn } from "../copilot/claudeRunner";
import type { ClaudeStatus } from "../setup/claudeStatus";
import { handleCorrectionDelete, handleCorrectionRequest, handlePeriodsRequest, handleSaveRequest, type ApiResponse } from "../store/saveApi";
import { originAllowed } from "./origin";

/** A report is ~100 KB of text and a chat a little more; 2 MB is generous and still bounded. */
export const MAX_BODY_BYTES = 2 * 1024 * 1024;

/** What the setup screen shows about the desktop app's own storage and optional course inputs. */
export interface AppInfo {
  dataDir: string;
  setupDismissed: boolean;
  handbook: { present: boolean; chars: number };
  lecture: { dir: string | null; notes: number };
}

/** Only the desktop app provides these; the dev server (Henri's browser launcher) has none, so its screens stay as they were. */
export interface AppServices {
  info(): AppInfo;
  setSetupDismissed(dismissed: boolean): void;
  claudeStatus(): Promise<ClaudeStatus>;
}

export interface ApiContext {
  vaultDir: string;
  /** Resolved per request: the desktop app's handbook and lecture folder can change while it runs. */
  copilot: () => CopilotConfig;
  spawn?: Spawn;
  app?: AppServices;
}

export interface ApiRequest {
  method: string;
  path: string;
  body: string;
  origin: string | undefined;
}

/**
 * Reads a request body, giving up (null) once it is larger than the limit — the caller answers 413.
 * Works for a Node request and for a web ReadableStream alike.
 */
export async function readBody(stream: AsyncIterable<Uint8Array | string>, max = MAX_BODY_BYTES): Promise<string | null> {
  const parts: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    const buf = typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk);
    size += buf.length;
    if (size > max) return null;
    parts.push(buf);
  }
  return Buffer.concat(parts).toString("utf8");
}

const NOT_ALLOWED: ApiResponse = { status: 405, body: { ok: false, error: "Method not allowed" } };

/**
 * Every /api route behind one function: vite.config.ts mounts it for the dev server and the desktop app
 * answers its app:// requests with it, so both behave the same. No HTTP plumbing in here (unit-tested).
 */
export async function handleApi(ctx: ApiContext, { method, path, body, origin }: ApiRequest): Promise<ApiResponse> {
  if (!originAllowed(origin)) return { status: 403, body: { ok: false, error: "The API only answers the app itself" } };
  try {
    switch (path) {
      case "/api/periods":
        return method === "GET" ? handlePeriodsRequest(ctx.vaultDir) : NOT_ALLOWED;
      case "/api/reports":
        return method === "POST" ? handleSaveRequest(ctx.vaultDir, body, origin) : NOT_ALLOWED;
      case "/api/corrections":
        if (method === "POST") return handleCorrectionRequest(ctx.vaultDir, body, origin);
        return method === "DELETE" ? handleCorrectionDelete(ctx.vaultDir, body, origin) : NOT_ALLOWED;
      case "/api/copilot":
        return method === "POST" ? await handleCopilotRequest(ctx.copilot(), body, origin, ctx.spawn ?? spawnClaude) : NOT_ALLOWED;
      case "/api/app":
        if (method !== "GET") return NOT_ALLOWED;
        return { status: 200, body: ctx.app ? { desktop: true, ...ctx.app.info() } : { desktop: false } };
      case "/api/claude/status":
        if (!ctx.app) break;
        return method === "GET" ? { status: 200, body: { ...(await ctx.app.claudeStatus()) } } : NOT_ALLOWED;
      case "/api/app/setup": {
        if (!ctx.app) break;
        if (method !== "POST") return NOT_ALLOWED;
        let dismissed: unknown;
        try {
          dismissed = (JSON.parse(body) as { dismissed?: unknown }).dismissed;
        } catch {
          /* falls through to the 400 below */
        }
        if (typeof dismissed !== "boolean") return { status: 400, body: { ok: false, error: 'Body must be JSON: {"dismissed": true | false}' } };
        ctx.app.setSetupDismissed(dismissed);
        return { status: 200, body: { ok: true } };
      }
    }
  } catch {
    return { status: 500, body: { ok: false, error: "Something went wrong inside the app" } };
  }
  return { status: 404, body: { ok: false, error: "Unknown route" } };
}
