import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { handleCopilotRequest, readLectureNotes } from "../src/copilot/copilotApi";
import type { Spawn } from "../src/copilot/claudeRunner";
import { saveReport } from "../src/store/periodStore";
import { p0Report } from "./fixtures";

const CM = p0Report("=== Report11_Contribution Margin.pdf", "=== ");
const LOCAL = "http://127.0.0.1:5181";

function setup() {
  const root = mkdtempSync(join(tmpdir(), "topsim-copilot-"));
  const vault = join(root, "TOPSIM");
  const course = join(root, "course");
  mkdirSync(join(course, "Class Material"), { recursive: true });
  writeFileSync(join(course, "Class Notes.md"), "CM II = revenue minus variable costs");
  writeFileSync(join(course, "Class Material", "Script 1.md"), "SCRIPT-ONE");
  writeFileSync(join(course, "Class Material", "Script 1.pdf"), "binary");
  writeFileSync(join(course, "Assignments.md"), "private homework");
  const handbook = join(root, "handbook.txt");
  writeFileSync(handbook, "HANDBOOK-BODY");
  saveReport(vault, CM);
  return { vault, course, handbook };
}

function recorder(answer = "An answer [Handbook]."): { spawn: Spawn; seen: { args: string[]; stdin: string }[] } {
  const seen: { args: string[]; stdin: string }[] = [];
  return { seen, spawn: async (args, stdin) => (seen.push({ args, stdin }), { stdout: answer, stderr: "", code: 0 }) };
}

describe("readLectureNotes", () => {
  it("reads Class Notes and the Class Material notes (markdown only), and nothing else in the course folder", () => {
    const { course } = setup();
    const notes = readLectureNotes(course);
    expect(notes.map((n) => n.name).sort()).toEqual(["Class Material/Script 1.md", "Class Notes.md"]);
    expect(notes.find((n) => n.name === "Class Notes.md")!.text).toContain("CM II");
  });

  it("returns [] when the course folder does not exist (the copilot still works from handbook + reports)", () => {
    expect(readLectureNotes(join(tmpdir(), "no-such-course-folder"))).toEqual([]);
  });
});

describe("handleCopilotRequest (POST /api/copilot)", () => {
  const body = (extra = {}) => JSON.stringify({ mode: "coach", messages: [{ role: "user", text: "Explain my CM" }], ...extra });

  it("answers from the handbook, the lecture notes and the saved reports", async () => {
    const { vault, course, handbook } = setup();
    const r = recorder();
    const res = await handleCopilotRequest({ vaultDir: vault, courseDir: course, handbookPath: handbook }, body(), LOCAL, r.spawn);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      text: "An answer [Handbook].",
      // the labels the answer may cite — the page flags any other citation
      sources: ["Handbook", "Lecture: Class Notes.md", "Lecture: Class Material/Script 1.md", "Period 0 · TNB10 · Contribution Margin"],
    });
    const system = r.seen[0].args[r.seen[0].args.indexOf("--system-prompt") + 1];
    expect(system).toContain("HANDBOOK-BODY");
    expect(system).toContain("SCRIPT-ONE");
    expect(system).toContain("[Period 0 · TNB10 · Contribution Margin]");
    expect(system).toContain("MODE: COACH");
    expect(system).not.toContain("private homework");
    expect(r.seen[0].stdin).toContain("Explain my CM");
  });

  it("switches to propose mode when asked", async () => {
    const { vault, course, handbook } = setup();
    const r = recorder();
    await handleCopilotRequest({ vaultDir: vault, courseDir: course, handbookPath: handbook }, body({ mode: "propose" }), LOCAL, r.spawn);
    expect(r.seen[0].args[r.seen[0].args.indexOf("--system-prompt") + 1]).toContain("MODE: PROPOSE");
  });

  it("answers 400 for a bad body, 403 for another website, and never starts claude for either", async () => {
    const { vault, course, handbook } = setup();
    const r = recorder();
    const cfg = { vaultDir: vault, courseDir: course, handbookPath: handbook };
    expect((await handleCopilotRequest(cfg, "nope", LOCAL, r.spawn)).status).toBe(400);
    expect((await handleCopilotRequest(cfg, body({ mode: "dance" }), LOCAL, r.spawn)).status).toBe(400);
    expect((await handleCopilotRequest(cfg, body({ messages: [] }), LOCAL, r.spawn)).status).toBe(400);
    expect((await handleCopilotRequest(cfg, body({ messages: [{ role: "assistant", text: "x" }] }), LOCAL, r.spawn)).status).toBe(400);
    expect((await handleCopilotRequest(cfg, body(), "https://evil.example", r.spawn)).status).toBe(403);
    expect(r.seen).toEqual([]);
  });

  it("passes claude's failure on as a 502 with the readable message", async () => {
    const { vault, course, handbook } = setup();
    const res = await handleCopilotRequest(
      { vaultDir: vault, courseDir: course, handbookPath: handbook },
      body(),
      LOCAL,
      async () => ({ stdout: "", stderr: "Not logged in", code: 1 }),
    );
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ ok: false, error: "Claude could not answer: Not logged in" });
  });
});
