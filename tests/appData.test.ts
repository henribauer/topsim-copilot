import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readSettings, writeSettings } from "../src/setup/settings";
import { handbookInfo, importHandbook, removeHandbook } from "../src/setup/sources";

const tmp = () => mkdtempSync(join(tmpdir(), "topsim-appdata-"));

describe("app settings (settings.json in the app's own data folder)", () => {
  it("starts with defaults when the file is missing or damaged", () => {
    const dir = tmp();
    expect(readSettings(join(dir, "settings.json"))).toEqual({ setupDismissed: false, lectureDir: null });
    writeFileSync(join(dir, "settings.json"), "{ not json");
    expect(readSettings(join(dir, "settings.json"))).toEqual({ setupDismissed: false, lectureDir: null });
  });

  it("remembers a change across reads and keeps what it was not asked to change", () => {
    const file = join(tmp(), "settings.json");
    writeSettings(file, { lectureDir: "/some/folder" });
    writeSettings(file, { setupDismissed: true });
    expect(readSettings(file)).toEqual({ setupDismissed: true, lectureDir: "/some/folder" });
  });

  it("ignores values of the wrong type instead of trusting the file", () => {
    const file = join(tmp(), "settings.json");
    writeFileSync(file, JSON.stringify({ setupDismissed: "yes", lectureDir: 5 }));
    expect(readSettings(file)).toEqual({ setupDismissed: false, lectureDir: null });
  });
});

describe("the user's own handbook (a text file they supply)", () => {
  const source = (content: string | Buffer) => {
    const f = join(tmp(), "mine.txt");
    writeFileSync(f, content);
    return f;
  };

  it("copies a text file into the app's sources folder and reports it; removing it empties the slot", () => {
    const dir = tmp();
    expect(handbookInfo(dir)).toEqual({ present: false, chars: 0, path: null });
    const r = importHandbook(dir, source("1 Introduction\nProfit = revenue - costs\n"));
    expect(r.chars).toBe(40);
    const info = handbookInfo(dir);
    expect(info).toMatchObject({ present: true, chars: 40 });
    expect(readFileSync(info.path!, "utf8")).toContain("Profit = revenue");
    removeHandbook(dir);
    expect(handbookInfo(dir).present).toBe(false);
  });

  it("refuses a PDF, binary data, an empty file and an oversized file — with a reason in words, and stores nothing", () => {
    const dir = tmp();
    expect(() => importHandbook(dir, source("%PDF-1.7\n..."))).toThrow(/PDF/);
    expect(() => importHandbook(dir, source(Buffer.from([0x41, 0x00, 0x42])))).toThrow(/text file/);
    expect(() => importHandbook(dir, source("  \n"))).toThrow(/empty/);
    expect(() => importHandbook(dir, source("x".repeat(50)), 10)).toThrow(/too large/);
    expect(existsSync(join(dir, "handbook.txt"))).toBe(false);
  });
});
