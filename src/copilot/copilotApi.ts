import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { originAllowed } from "../server/origin";
import { loadPeriods } from "../store/periodStore";
import type { ApiResponse } from "../store/saveApi";
import { askClaude, spawnClaude, type Spawn, type Turn } from "./claudeRunner";
import { buildSystemPrompt, sourceLabels, type CopilotMode, type LectureNote } from "./context";

export interface CopilotConfig {
  vaultDir: string;
  /** The course's folder (the vault's, or one the user picked); read-only — the app never writes there. None = no lecture notes. */
  courseDir?: string;
  /** The handbook text file. None, or a path that is gone = the copilot works without a handbook. */
  handbookPath?: string;
}

/** A user-picked folder may hold anything: at most this many notes, each at most this big, and only real files. */
export const MAX_NOTES = 60;
export const MAX_NOTE_BYTES = 1024 * 1024;
/**
 * The system prompt travels as one command-line argument and macOS allows about 1 MiB for arguments plus
 * environment, so a bigger prompt would die with an opaque E2BIG. Say so in words before starting claude.
 */
export const MAX_PROMPT_BYTES = 900_000;

/**
 * Class Notes plus the markdown notes in Class Material — the lecture sources named in the PRD.
 * Assignments, exam schedule, flashcards and weekly reviews stay out: they are personal and not course content.
 */
export function readLectureNotes(courseDir: string): LectureNote[] {
  const notes: LectureNote[] = [];
  const list = (dir: string): string[] => {
    try {
      return readdirSync(dir).sort();
    } catch {
      return [];
    }
  };
  const add = (name: string, path: string) => {
    try {
      // lstat, not stat: a symlink (to a key file, say) is not a note, however it is named.
      const st = lstatSync(path);
      if (st.isFile() && st.size <= MAX_NOTE_BYTES && notes.length < MAX_NOTES) notes.push({ name, text: readFileSync(path, "utf8") });
    } catch {
      /* missing or unreadable: not a note */
    }
  };
  add("Class Notes.md", join(courseDir, "Class Notes.md"));
  // "Class Material.md" is only the folder's link list.
  for (const f of list(join(courseDir, "Class Material"))) if (f.endsWith(".md") && f !== "Class Material.md") add(`Class Material/${f}`, join(courseDir, "Class Material", f));
  // A folder that is not laid out like the course vault: take its top-level text and Markdown notes instead.
  if (notes.length === 0) for (const f of list(courseDir).filter((n) => /\.(md|txt)$/i.test(n))) add(f, join(courseDir, f));
  return notes;
}

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
  if (!originAllowed(origin)) {
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
    handbook: cfg.handbookPath && existsSync(cfg.handbookPath) ? readFileSync(cfg.handbookPath, "utf8") : null,
    lecture: cfg.courseDir ? readLectureNotes(cfg.courseDir) : [],
    periods: loadPeriods(cfg.vaultDir),
  };
  const system = buildSystemPrompt({ mode: mode as CopilotMode, ...material });
  const size = Buffer.byteLength(system);
  if (size > MAX_PROMPT_BYTES) {
    const kb = (n: number) => Math.round(n / 1000);
    return { status: 413, body: { ok: false, error: `Your reports, handbook and lecture notes together are too large to send in one question (${kb(size)} KB; the limit is ${kb(MAX_PROMPT_BYTES)} KB). Use a smaller handbook or fewer lecture notes.` } };
  }
  const result = await askClaude({ system, history: messages as Turn[], model: MODEL }, spawn);
  return result.ok
    ? { status: 200, body: { ok: true, text: result.text, sources: sourceLabels(material) } }
    : { status: 502, body: { ok: false, error: result.error } };
}
