import { chmodSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_NOTE_BYTES, MAX_PROMPT_BYTES, handleCopilotRequest, readLectureNotes } from "../src/copilot/copilotApi";
import type { Spawn } from "../src/copilot/claudeRunner";
import { MAX_HANDBOOK_BYTES } from "../src/setup/sources";

const tmp = () => mkdtempSync(join(tmpdir(), "topsim-harden-"));

describe("readLectureNotes never throws and only reads real, reasonably sized note files", () => {
  it("skips a symlink (it could point at a key file), a directory named like a note, and an oversized note", () => {
    const secret = join(tmp(), "secret.txt");
    writeFileSync(secret, "TOP-SECRET");
    const dir = tmp();
    mkdirSync(join(dir, "Class Material", "Folder.md"), { recursive: true });
    symlinkSync(secret, join(dir, "Class Notes.md"));
    writeFileSync(join(dir, "Class Material", "Big.md"), "x".repeat(MAX_NOTE_BYTES + 1));
    writeFileSync(join(dir, "Class Material", "Good.md"), "GOOD");
    const notes = readLectureNotes(dir);
    expect(notes.map((n) => n.name)).toEqual(["Class Material/Good.md"]);
    expect(JSON.stringify(notes)).not.toContain("TOP-SECRET");
  });

  it("skips symlinks in a loose folder too", () => {
    const secret = join(tmp(), "secret.md");
    writeFileSync(secret, "TOP-SECRET");
    const dir = tmp();
    symlinkSync(secret, join(dir, "link.md"));
    writeFileSync(join(dir, "real.md"), "REAL");
    expect(readLectureNotes(dir).map((n) => n.name)).toEqual(["real.md"]);
  });

  it("returns what it can (here: nothing) when a folder cannot be read, instead of throwing", () => {
    const dir = tmp();
    mkdirSync(join(dir, "Class Material"));
    writeFileSync(join(dir, "Class Material", "a.md"), "A");
    chmodSync(join(dir, "Class Material"), 0o000);
    try {
      expect(() => readLectureNotes(dir)).not.toThrow();
    } finally {
      chmodSync(join(dir, "Class Material"), 0o755);
    }
  });
});

describe("a question whose sources are too big for one claude call", () => {
  it("gets a clear 413 in words (not an opaque E2BIG) and never starts claude", async () => {
    const dir = tmp();
    const handbookPath = join(dir, "handbook.txt");
    writeFileSync(handbookPath, "h".repeat(MAX_PROMPT_BYTES + 1));
    let started = false;
    const spawn: Spawn = async () => ((started = true), { stdout: "x", stderr: "", code: 0 });
    const body = JSON.stringify({ mode: "coach", messages: [{ role: "user", text: "hi" }] });
    const res = await handleCopilotRequest({ vaultDir: dir, handbookPath }, body, undefined, spawn);
    expect(res.status).toBe(413);
    expect(String(res.body.error)).toMatch(/too large/);
    expect(started).toBe(false);
  });

  it("is prevented at the source: a handbook can never be larger than what a question may carry", () => {
    expect(MAX_HANDBOOK_BYTES).toBeLessThan(MAX_PROMPT_BYTES);
  });
});
