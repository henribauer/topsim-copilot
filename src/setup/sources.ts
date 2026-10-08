import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Well under what one copilot question can carry (copilotApi MAX_PROMPT_BYTES). */
export const MAX_HANDBOOK_BYTES = 600_000;
const FILE = "handbook.txt";

/**
 * The handbook is the user's own copy of the TOPSIM participant manual — the app does not ship it. A plain text
 * file is enough for now (a PDF would need its own extraction step), so anything else is refused with a reason.
 * Throws an Error whose message is meant to be shown to the user.
 */
export function importHandbook(sourcesDir: string, from: string, maxBytes = MAX_HANDBOOK_BYTES): { chars: number } {
  if (statSync(from).size > maxBytes) throw new Error(`That file is too large (the limit is ${Math.round(maxBytes / 1000)} KB).`);
  const buf = readFileSync(from);
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") {
    throw new Error("That is a PDF. Copy the text out of the PDF into a .txt file and add that file instead.");
  }
  if (buf.subarray(0, 8192).includes(0)) throw new Error("That does not look like a text file.");
  const text = buf.toString("utf8");
  if (text.trim() === "") throw new Error("That file is empty.");
  mkdirSync(sourcesDir, { recursive: true });
  const tmp = join(sourcesDir, `${FILE}.tmp`);
  writeFileSync(tmp, text);
  renameSync(tmp, join(sourcesDir, FILE));
  return { chars: text.length };
}

export function removeHandbook(sourcesDir: string): void {
  rmSync(join(sourcesDir, FILE), { force: true });
}

export function handbookInfo(sourcesDir: string): { present: boolean; chars: number; path: string | null } {
  const path = join(sourcesDir, FILE);
  if (!existsSync(path)) return { present: false, chars: 0, path: null };
  return { present: true, chars: readFileSync(path, "utf8").length, path };
}
