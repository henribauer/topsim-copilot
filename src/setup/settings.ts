import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** The desktop app's own small settings file; only these two things are remembered. */
export interface AppSettings {
  /** Setup was closed ("Skip for now" or "Done"): do not open it by itself again. */
  setupDismissed: boolean;
  /** The folder the user chose for lecture notes, or null. */
  lectureDir: string | null;
}

const DEFAULTS: AppSettings = { setupDismissed: false, lectureDir: null };

export function readSettings(file: string): AppSettings {
  try {
    const raw = JSON.parse(readFileSync(file, "utf8")) as Partial<Record<keyof AppSettings, unknown>>;
    return {
      setupDismissed: typeof raw.setupDismissed === "boolean" ? raw.setupDismissed : DEFAULTS.setupDismissed,
      lectureDir: typeof raw.lectureDir === "string" ? raw.lectureDir : DEFAULTS.lectureDir,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeSettings(file: string, patch: Partial<AppSettings>): AppSettings {
  const next = { ...readSettings(file), ...patch };
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(next, null, 2) + "\n");
  renameSync(tmp, file);
  return next;
}
