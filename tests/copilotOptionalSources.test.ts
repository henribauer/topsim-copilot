import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { handleCopilotRequest, readLectureNotes } from "../src/copilot/copilotApi";
import type { Spawn } from "../src/copilot/claudeRunner";
import { saveReport } from "../src/store/periodStore";
import { p0Report } from "./fixtures";

const CM = p0Report("=== Report11_Contribution Margin.pdf", "=== ");
const body = JSON.stringify({ mode: "coach", messages: [{ role: "user", text: "Explain my CM" }] });

describe("the copilot without a handbook (the packaged app ships none)", () => {
  it("answers from the reports alone, offers no [Handbook] source and tells the model there is none", async () => {
    const vault = mkdtempSync(join(tmpdir(), "topsim-nohb-"));
    saveReport(vault, CM);
    let system = "";
    const spawn: Spawn = async (args) => ((system = args[args.indexOf("--system-prompt") + 1]), { stdout: "ok", stderr: "", code: 0 });
    const res = await handleCopilotRequest({ vaultDir: vault }, body, "app://topsim", spawn);
    expect(res.body).toEqual({ ok: true, text: "ok", sources: ["Period 0 · TNB10 · Contribution Margin"] });
    expect(system).toMatch(/No handbook was supplied/);
    expect(system).not.toMatch(/\[Handbook\]\n/);
  });

  it("uses the handbook when the user did supply one", async () => {
    const dir = mkdtempSync(join(tmpdir(), "topsim-hb-"));
    const handbookPath = join(dir, "handbook.txt");
    writeFileSync(handbookPath, "MY-OWN-HANDBOOK");
    const spawn: Spawn = async () => ({ stdout: "ok", stderr: "", code: 0 });
    const res = await handleCopilotRequest({ vaultDir: dir, handbookPath }, body, undefined, spawn);
    expect((res.body.sources as string[])[0]).toBe("Handbook");
  });
});

describe("readLectureNotes for a folder the user picked", () => {
  it("takes the top-level text and Markdown notes when the folder is not laid out like the course vault", () => {
    const dir = mkdtempSync(join(tmpdir(), "topsim-lect-"));
    writeFileSync(join(dir, "week1.md"), "WEEK-ONE");
    writeFileSync(join(dir, "week2.txt"), "WEEK-TWO");
    writeFileSync(join(dir, "slides.pdf"), "binary");
    mkdirSync(join(dir, "sub"));
    writeFileSync(join(dir, "sub", "deep.md"), "DEEP");
    expect(readLectureNotes(dir).map((n) => n.name)).toEqual(["week1.md", "week2.txt"]);
  });
});
