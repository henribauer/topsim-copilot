import { spawn as nodeSpawn } from "node:child_process";

export interface Turn {
  role: "user" | "assistant";
  text: string;
}

export interface AskInput {
  /** Mode rules + handbook + lecture notes + reports, built by context.ts. */
  system: string;
  history: Turn[];
  model: string;
}

export type AskResult = { ok: true; text: string } | { ok: false; error: string };

/** How `claude` gets started; injected so tests never call the real CLI. */
export type Spawn = (args: string[], stdin: string) => Promise<{ stdout: string; stderr: string; code: number }>;

/**
 * Real process. The CLI runs on Henri's Max subscription (PRD: no API key). `cwd` is a throwaway folder
 * so claude never reads a project's CLAUDE.md or files by accident.
 */
export const spawnClaude: Spawn = (args, stdin) =>
  new Promise((resolve, reject) => {
    const child = nodeSpawn("claude", args, { cwd: process.env.TMPDIR ?? "/tmp", stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
    child.stdin.end(stdin);
  });

/** The whole chat so far as one prompt: claude -p is one-shot, so earlier turns are replayed each time. */
function transcript(history: Turn[]): string {
  const lines = history.map((t) => `${t.role === "user" ? "Henri" : "Copilot"}: ${t.text}`);
  return `${lines.join("\n\n")}\n\nCopilot:`;
}

export async function askClaude({ system, history, model }: AskInput, spawn: Spawn = spawnClaude): Promise<AskResult> {
  const args = [
    "-p",
    "--system-prompt",
    system,
    "--model",
    model,
    // No tools: the copilot only talks — it cannot read files, run commands or browse.
    "--tools",
    "",
    // Without these three, claude loads Henri's hooks, MCP servers and skills: 18 s instead of 2.5 s per answer.
    "--no-session-persistence",
    "--setting-sources",
    "",
    "--strict-mcp-config",
    "--disable-slash-commands",
  ];
  try {
    const r = await spawn(args, transcript(history));
    if (r.code !== 0) {
      return { ok: false, error: `Claude could not answer: ${(r.stderr || r.stdout).trim() || `exit code ${r.code}`}` };
    }
    return { ok: true, text: r.stdout.trim() };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      return { ok: false, error: "The claude command was not found — it is not installed or not on the PATH of the app." };
    }
    return { ok: false, error: `Claude could not answer: ${e instanceof Error ? e.message : String(e)}` };
  }
}
