import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "../src/copilot/context";
import type { PeriodFile } from "../src/store/periodStore";

const period0: PeriodFile = {
  period: 0,
  company: "Company 2",
  reports: {
    TNB11: {
      kind: "pnl",
      savedAt: "2026-10-01T10:00:00.000Z",
      raw: "Profit and Loss Statement\nSales Revenue 6,000.00",
      parsed: { reportCode: "TNB11", title: "Profit and Loss Statement", period: 0, company: "Company 2" },
    },
  },
};
const base = { handbook: "HANDBOOK-TEXT", lecture: [{ name: "Class Notes.md", text: "LECTURE-TEXT" }], periods: [period0] };

describe("buildSystemPrompt", () => {
  it("grounds the answer in handbook, lecture notes and every saved report, each under a citable label", () => {
    const p = buildSystemPrompt({ ...base, mode: "coach" });
    expect(p).toContain("HANDBOOK-TEXT");
    expect(p).toContain("LECTURE-TEXT");
    expect(p).toContain("[Lecture: Class Notes.md]");
    // label directly followed by the report text (the rules also quote an example label, so match the block)
    expect(p).toContain("[Period 0 · TNB11 · Profit and Loss Statement]\nProfit and Loss Statement\nSales Revenue 6,000.00");
  });

  it("coach teaches and asks, propose recommends a full decision set — and says which mode it is in", () => {
    const coach = buildSystemPrompt({ ...base, mode: "coach" });
    const propose = buildSystemPrompt({ ...base, mode: "propose" });
    expect(coach).toMatch(/MODE: COACH/);
    expect(coach).toMatch(/do not hand over a finished decision/i);
    expect(propose).toMatch(/MODE: PROPOSE/);
    expect(propose).toMatch(/full decision set/i);
    expect(coach).not.toBe(propose);
  });

  it("tells the copilot about numbers Henri corrected, next to the report they belong to", () => {
    const fixed: PeriodFile = {
      ...period0,
      reports: { TNB11: { ...period0.reports.TNB11, corrections: [{ path: ["x"], from: 6000, to: "6,100.00", at: "t" }] } },
    };
    const p = buildSystemPrompt({ ...base, periods: [fixed], mode: "coach" });
    expect(p).toContain("Henri corrected the printed value 6000 to 6,100.00.");
  });

  it("works before any report is imported", () => {
    const p = buildSystemPrompt({ ...base, periods: [], mode: "coach" });
    expect(p).toContain("[Handbook]");
    // (the rules text quotes an example citation, so look for a real block: label + newline)
    expect(p).not.toMatch(/\[Period \d+ · TNB\d+ · [^\]]+\]\n/);
  });
});
