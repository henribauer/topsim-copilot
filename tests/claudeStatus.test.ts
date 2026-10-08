import { describe, expect, it } from "vitest";
import { checkClaude, runCommand, type Run, type RunResult } from "../src/setup/claudeStatus";

const done = (stdout: string, code: number | null = 0): RunResult => ({ code, stdout, timedOut: false, spawnFailed: false });
const TIMEOUT: RunResult = { code: null, stdout: "", timedOut: true, spawnFailed: false };
const NO_START: RunResult = { code: null, stdout: "", timedOut: false, spawnFailed: true };

/** A fake `claude` that answers `--version` and `auth status` from a table, recording how it was asked. */
function fake(version: RunResult, auth: RunResult) {
  const calls: { args: string[]; timeout: number }[] = [];
  const run: Run = async (_file, args, timeout) => {
    calls.push({ args, timeout });
    return args[0] === "--version" ? version : auth;
  };
  return { run, calls };
}
const find = () => "/Users/someone/.local/bin/claude";

describe("checkClaude — installation and sign-in are two separate, bounded checks", () => {
  it("is 'missing' when claude is nowhere, and never starts a process", async () => {
    const f = fake(done(""), done(""));
    const s = await checkClaude({ find: () => null, run: f.run });
    expect(s).toMatchObject({ state: "missing", installed: false, signedIn: null, version: null });
    expect(f.calls).toEqual([]);
  });

  it("is 'ready' when claude is installed and signed in — and nothing of the sign-in answer reaches the result", async () => {
    const f = fake(done("2.1.289 (Claude Code)\n"), done('{"loggedIn":true,"authMethod":"claude.ai","email":"private@example.com","token":"sk-secret"}'));
    const s = await checkClaude({ find, run: f.run });
    expect(s).toMatchObject({ state: "ready", installed: true, signedIn: true, version: "2.1.289" });
    expect(JSON.stringify(s)).not.toMatch(/private@example|sk-secret|someone/);
  });

  it("is 'installed-logged-out' when claude is there but not signed in (answer says so, or exit code 1)", async () => {
    expect(await checkClaude({ find, run: fake(done("2.1.0"), done('{"loggedIn":false}', 1)).run })).toMatchObject({ state: "installed-logged-out", installed: true, signedIn: false });
    expect(await checkClaude({ find, run: fake(done("2.1.0"), done("", 1)).run })).toMatchObject({ state: "installed-logged-out", signedIn: false });
  });

  it("is 'check-failed' when claude does not answer --version in time, and then does not ask about sign-in", async () => {
    const f = fake(TIMEOUT, done('{"loggedIn":true}'));
    const s = await checkClaude({ find, run: f.run });
    expect(s).toMatchObject({ state: "check-failed", installed: null, signedIn: null });
    expect(s.message).toMatch(/5 s/);
    expect(f.calls.map((c) => c.args[0])).toEqual(["--version"]);
  });

  it("is 'check-failed' (installed, sign-in unknown) when the sign-in check times out, cannot start or answers nonsense", async () => {
    for (const auth of [TIMEOUT, NO_START, done("<html>", 0), done("boom", 2)]) {
      expect(await checkClaude({ find, run: fake(done("2.1.0"), auth).run })).toMatchObject({ state: "check-failed", installed: true, signedIn: null });
    }
    expect((await checkClaude({ find, run: fake(done("2.1.0"), TIMEOUT).run })).message).toMatch(/10 s/);
  });

  it("gives each check its own time limit: 5 s for the version, 10 s for sign-in", async () => {
    const f = fake(done("2.1.0"), done('{"loggedIn":true}'));
    await checkClaude({ find, run: f.run });
    expect(f.calls).toEqual([
      { args: ["--version"], timeout: 5000 },
      { args: ["auth", "status"], timeout: 10000 },
    ]);
  });
});

describe("runCommand — the real process runner", () => {
  it("returns the output and exit code of a normal command", async () => {
    expect(await runCommand("/bin/echo", ["hi"], 2000)).toEqual({ code: 0, stdout: "hi\n", timedOut: false, spawnFailed: false });
    expect((await runCommand("/bin/sh", ["-c", "exit 3"], 2000)).code).toBe(3);
  });
  it("kills a command that outlives its limit, and reports a missing program as 'cannot start'", async () => {
    const t0 = Date.now();
    expect((await runCommand("/bin/sleep", ["5"], 200)).timedOut).toBe(true);
    expect(Date.now() - t0).toBeLessThan(3000);
    expect((await runCommand("/no/such/claude", [], 200)).spawnFailed).toBe(true);
  });
});
