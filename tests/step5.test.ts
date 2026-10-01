import { describe, expect, it } from "vitest";
import { GLOSSARY, letterIndex, entriesForLetter, searchGlossary } from "../src/learn/glossary";
import { generateQuiz, retryHint } from "../src/learn/quiz";
import { importSteps } from "../src/import/steps";
import { savedP0 } from "./fixtures";

/**
 * Redesign step 5 (design guide R5, R6). Mobbin refs docs/mobbin/learn.json (Duolingo, The Leap: one question per
 * screen, feedback on the option row itself; Uxcel, Selfridges: one letter strip, text-only rows) and
 * docs/mobbin/import.json (Resend, Remote, Calendly, Workable: one action per screen, a quiet stepper).
 */
describe("retryHint (D34/C5: Try again before the answer is revealed)", () => {
  const quiz = generateQuiz(savedP0());
  const q = (id: string) => quiz.find((x) => x.id === id)!;

  it("says the answer was too low or too high, without giving the answer away", () => {
    const low = retryHint(q("cm1"), "3000")!;
    expect(low).toMatch(/too low/i);
    expect(low).not.toContain("3,320");
    expect(retryHint(q("cm1"), "3500")).toMatch(/too high/i);
  });

  it("points at the unit when the answer is 1,000 times off", () => {
    expect(retryHint(q("cm1"), "3,320,000")).toMatch(/TEUR/);
    expect(retryHint(q("cmUnit"), "0.083")).toMatch(/TEUR/);
  });

  it("points at the formula via the concept name", () => {
    expect(retryHint(q("breakEven"), "100")).toContain("Break-even point");
  });

  it("has nothing to say for a right answer, an unreadable one, or a multiple-choice question", () => {
    expect(retryHint(q("cm1"), "3320")).toBeNull();
    expect(retryHint(q("cm1"), "abc")).toBeNull();
    expect(retryHint(q("variableCost"), 2)).toBeNull();
  });
});

describe("glossary letter strip (D32; Uxcel, Selfridges)", () => {
  it("lists each starting letter once, in order, with how many terms it holds", () => {
    const idx = letterIndex(GLOSSARY);
    expect(idx.map((l) => l.letter)).toEqual([...new Set(GLOSSARY.map((e) => e.term[0].toUpperCase()))].sort());
    expect(idx.reduce((s, l) => s + l.count, 0)).toBe(GLOSSARY.length);
    expect(idx.find((l) => l.letter === "C")!.count).toBe(GLOSSARY.filter((e) => e.term.startsWith("C")).length);
  });

  it("returns the terms of one letter alphabetically", () => {
    const c = entriesForLetter(GLOSSARY, "C").map((e) => e.term);
    expect(c.length).toBeGreaterThan(3);
    expect(c).toEqual([...c].sort((a, b) => a.localeCompare(b)));
    expect(c.every((t) => t.startsWith("C"))).toBe(true);
    expect(entriesForLetter(GLOSSARY, "Q")).toEqual([]);
    expect(entriesForLetter(GLOSSARY, "c").map((e) => e.term)).toEqual(c); // a lowercase letter finds the same terms
  });

  it("is unaffected by searching: the search still finds terms across letters", () => {
    expect(searchGlossary("break-even")[0].term).toBe("Break-even point");
  });
});

describe("importSteps (R6: the stepper shrinks once data exists)", () => {
  it("starts on step 1 while nothing was dropped or it is still being read", () => {
    expect(importSteps({ status: "idle" })).toEqual({ current: 1, labels: ["Add files", "Check", "Save"], done: false });
    expect(importSteps({ status: "reading" }).current).toBe(1);
  });

  it("moves to step 2 when reports were found but are not all saved", () => {
    expect(importSteps({ status: "ready", readable: 16, saved: 0 }).current).toBe(2);
    expect(importSteps({ status: "ready", readable: 16, saved: 7 }).current).toBe(2);
  });

  it("is on step 3 and done when every readable report is saved", () => {
    const s = importSteps({ status: "ready", readable: 16, saved: 16 });
    expect(s.current).toBe(3);
    expect(s.done).toBe(true);
  });

  it("stays on step 2 when nothing could be read, because there is nothing to save", () => {
    const s = importSteps({ status: "ready", readable: 0, saved: 0 });
    expect(s.current).toBe(2);
    expect(s.done).toBe(false);
  });
});
