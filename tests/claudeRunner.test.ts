import { describe, expect, it } from "vitest";
import { askClaude, type Spawn } from "../src/copilot/claudeRunner";

/** A fake `claude`: records what it was started with and answers with fixed text. */
function fake(stdout: string, code = 0, stderr = ""): { spawn: Spawn; calls: { args: string[]; stdin: string }[] } {
  const calls: { args: string[]; stdin: string }[] = [];
  const spawn: Spawn = async (args, stdin) => {
    calls.push({ args, stdin });
    return { stdout, stderr, code };
  };
  return { spawn, calls };
}

describe("askClaude", () => {
  it("sends the conversation on stdin, the sources as system prompt, and returns the answer text", async () => {
    const { spawn, calls } = fake("  The answer [Handbook].\n");
    const out = await askClaude(
      { system: "SYSTEM", history: [{ role: "user", text: "What is CM II?" }], model: "sonnet" },
      spawn,
    );
    expect(out).toEqual({ ok: true, text: "The answer [Handbook]." });
    expect(calls[0].args).toEqual(expect.arrayContaining(["-p", "--system-prompt", "SYSTEM", "--model", "sonnet"]));
    expect(calls[0].stdin).toContain("What is CM II?");
  });

  it("starts claude with no tools, no saved session and no user settings — a fast, read-only answerer", async () => {
    const { spawn, calls } = fake("ok");
    await askClaude({ system: "S", history: [{ role: "user", text: "hi" }], model: "sonnet" }, spawn);
    const a = calls[0].args;
    expect(a[a.indexOf("--tools") + 1]).toBe("");
    expect(a).toContain("--no-session-persistence");
    expect(a[a.indexOf("--setting-sources") + 1]).toBe("");
    expect(a).toContain("--strict-mcp-config");
    expect(a).toContain("--disable-slash-commands");
  });

  it("replays earlier turns so a follow-up question has its context", async () => {
    const { spawn, calls } = fake("ok");
    await askClaude(
      {
        system: "S",
        model: "sonnet",
        history: [
          { role: "user", text: "What is CM II?" },
          { role: "assistant", text: "Revenue minus variable cost." },
          { role: "user", text: "And CM III?" },
        ],
      },
      spawn,
    );
    const s = calls[0].stdin;
    expect(s.indexOf("What is CM II?")).toBeLessThan(s.indexOf("Revenue minus variable cost."));
    expect(s.indexOf("Revenue minus variable cost.")).toBeLessThan(s.indexOf("And CM III?"));
    expect(s).toMatch(/Henri:[\s\S]*Copilot:[\s\S]*Henri:/);
  });

  it("turns a failing claude into a readable message instead of throwing", async () => {
    const out = await askClaude(
      { system: "S", history: [{ role: "user", text: "hi" }], model: "sonnet" },
      fake("", 1, "Not logged in · Please run /login").spawn,
    );
    expect(out).toEqual({ ok: false, error: "Claude could not answer: Not logged in · Please run /login" });
  });

  it("explains it when the claude command is not installed", async () => {
    const out = await askClaude(
      { system: "S", history: [{ role: "user", text: "hi" }], model: "sonnet" },
      async () => {
        throw Object.assign(new Error("spawn claude ENOENT"), { code: "ENOENT" });
      },
    );
    expect(out.ok).toBe(false);
    expect((out as { error: string }).error).toMatch(/claude.*not (installed|found)/i);
  });
});
