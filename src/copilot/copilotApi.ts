import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadPeriods } from "../store/periodStore";
import type { ApiResponse } from "../store/saveApi";
import { askClaude, spawnClaude, type Spawn, type Turn } from "./claudeRunner";
import { buildSystemPrompt, sourceLabels, type CopilotMode, type LectureNote } from "./context";

export interface CopilotConfig {
  vaultDir: string;
  /** The course's folder in the vault; read-only — the app never writes there. */
  courseDir: string;
  handbookPath: string;
}

/**
 * Class Notes plus the markdown notes in Class Material — the lecture sources named in the PRD.
 * Assignments, exam schedule, flashcards and weekly reviews stay out: they are personal and not course content.
 */
export function readLectureNotes(courseDir: string): LectureNote[] {
  const notes: LectureNote[] = [];
  const add = (name: string, path: string) => {
    if (existsSync(path)) notes.push({ name, text: readFileSync(path, "utf8") });
  };
  add("Class Notes.md", join(courseDir, "Class Notes.md"));
  const material = join(courseDir, "Class Material");
  if (existsSync(material)) {
    for (const f of readdirSync(material).sort()) {
      // "Class Material.md" is only the folder's link list.
      if (f.endsWith(".md") && f !== "Class Material.md") add(`Class Material/${f}`, join(material, f));
    }
  }
  return notes;
}

const LOCAL_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;
const USAGE = 'Body must be JSON: {"mode": "coach" | "propose", "messages": [{"role": "user" | "assistant", "text": "…"}]}';
/** Sonnet answers in a few seconds on the Max plan; a heavier model is Henri's call, not a default. */
const MODEL = "sonnet";

/** POST /api/copilot. Only the app's own page may ask: every question spends Henri's Max-plan quota. */
export async function handleCopilotRequest(
  cfg: CopilotConfig,
  rawBody: string,
  origin: string | undefined,
  spawn: Spawn = spawnClaude,
): Promise<ApiResponse> {
  if (origin !== undefined && !LOCAL_ORIGIN.test(origin)) {
    return { status: 403, body: { ok: false, error: "The copilot only answers the app itself" } };
  }
  let parsed: { mode?: unknown; messages?: unknown };
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { ok: false, error: USAGE } };
  }
  const { mode, messages } = parsed;
  const valid =
    (mode === "coach" || mode === "propose") &&
    Array.isArray(messages) &&
    messages.length > 0 &&
    messages.every((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.text === "string") &&
    // claude -p answers the last turn, so the chat must end with Henri's question.
    messages[messages.length - 1].role === "user";
  if (!valid) return { status: 400, body: { ok: false, error: USAGE } };

  const material = {
    handbook: existsSync(cfg.handbookPath) ? readFileSync(cfg.handbookPath, "utf8") : "(handbook file not found)",
    lecture: readLectureNotes(cfg.courseDir),
    periods: loadPeriods(cfg.vaultDir),
  };
  const system = buildSystemPrompt({ mode: mode as CopilotMode, ...material });
  const result = await askClaude({ system, history: messages as Turn[], model: MODEL }, spawn);
  return result.ok
    ? { status: 200, body: { ok: true, text: result.text, sources: sourceLabels(material) } }
    : { status: 502, body: { ok: false, error: result.error } };
}
