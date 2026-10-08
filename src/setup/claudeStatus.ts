import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { claudeEnv, findClaudeBinary } from "../copilot/claudePath";

export type ClaudeState = "missing" | "installed-logged-out" | "ready" | "check-failed";

/**
 * What the setup screen may know about Claude: whether it is installed, whether it is signed in, its version —
 * and a message written here. The CLI's own output (`claude auth status` prints the account email) never leaves
 * this module: it is parsed for one boolean and dropped.
 */
export interface ClaudeStatus {
  state: ClaudeState;
  /** null = could not tell. */
  installed: boolean | null;
  signedIn: boolean | null;
  version: string | null;
  message: string;
}

export interface RunResult {
  code: number | null;
  stdout: string;
  timedOut: boolean;
  /** The program could not be started at all (missing, not executable). */
  spawnFailed: boolean;
}
export type Run = (file: string, args: string[], timeoutMs: number) => Promise<RunResult>;

export const VERSION_TIMEOUT_MS = 5000;
export const AUTH_TIMEOUT_MS = 10000;

/** Runs a program with a hard time limit (killed when it is over) and a small output cap. Never rejects. */
export const runCommand: Run = (file, args, timeoutMs) =>
  new Promise((resolve) => {
    const child = execFile(
      file,
      args,
      { timeout: timeoutMs, killSignal: "SIGKILL", env: claudeEnv(), cwd: tmpdir(), maxBuffer: 64 * 1024, windowsHide: true },
      (err, stdout) => {
        const e = err as (Error & { code?: number | string; killed?: boolean }) | null;
        if (!e) return resolve({ code: 0, stdout: String(stdout), timedOut: false, spawnFailed: false });
        if (e.killed) return resolve({ code: null, stdout: "", timedOut: true, spawnFailed: false });
        if (typeof e.code === "number") return resolve({ code: e.code, stdout: String(stdout), timedOut: false, spawnFailed: false });
        resolve({ code: null, stdout: "", timedOut: false, spawnFailed: true });
      },
    );
    child.stdin?.end();
  });

const verdict = (state: ClaudeState, installed: boolean | null, signedIn: boolean | null, version: string | null, message: string): ClaudeStatus => ({
  state,
  installed,
  signedIn,
  version,
  message,
});

/**
 * Two separate questions, each with its own time limit: is Claude installed (`--version`), and is it signed in
 * (`auth status`). It only ever reads: nothing is installed, no login or logout is triggered.
 */
export async function checkClaude({ find = findClaudeBinary, run = runCommand }: { find?: () => string | null; run?: Run } = {}): Promise<ClaudeStatus> {
  const bin = find();
  if (!bin) return verdict("missing", false, null, null, "Claude is not installed on this Mac.");

  const v = await run(bin, ["--version"], VERSION_TIMEOUT_MS);
  if (v.timedOut) return verdict("check-failed", null, null, null, "Claude did not answer within 5 s, so it could not be checked.");
  if (v.spawnFailed || v.code !== 0) return verdict("check-failed", null, null, null, "Claude was found but could not be started.");
  const version = /\d+\.\d+\.\d+/.exec(v.stdout)?.[0] ?? null;

  const a = await run(bin, ["auth", "status"], AUTH_TIMEOUT_MS);
  if (a.timedOut) return verdict("check-failed", true, null, version, "Claude is installed, but the sign-in check did not finish within 10 s.");
  if (a.spawnFailed) return verdict("check-failed", true, null, version, "Claude is installed, but the sign-in check could not be started.");
  let loggedIn: unknown;
  try {
    loggedIn = (JSON.parse(a.stdout) as { loggedIn?: unknown }).loggedIn;
  } catch {
    /* not JSON: judged by the exit code below */
  }
  if (loggedIn === true && a.code === 0) return verdict("ready", true, true, version, "Claude is installed and signed in.");
  if (loggedIn === false || a.code === 1) return verdict("installed-logged-out", true, false, version, "Claude is installed, but you are not signed in.");
  return verdict("check-failed", true, null, version, "Claude is installed, but its sign-in answer could not be understood.");
}
