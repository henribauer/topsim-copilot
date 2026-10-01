import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { gradeAnswer, generateQuiz, parseAnswer, summarize } from "../src/learn/quiz";
import { GLOSSARY } from "../src/learn/glossary";
import { loadPeriods, saveReport, type PeriodFile } from "../src/store/periodStore";
import { p0Report } from "./fixtures";

function p0(codes = ["Report11_Contribution Margin.pdf", "Report12_Profit and Loss Statement.pdf", "Report16_Balance Sheet.pdf", "Report10_Cost Unit Accounting.pdf"]): PeriodFile {
  const dir = mkdtempSync(join(tmpdir(), "topsim-quiz-"));
  for (const c of codes) saveReport(dir, p0Report(`=== ${c}`, "=== "));
  return loadPeriods(dir)[0];
}

describe("generateQuiz", () => {
  const quiz = generateQuiz(p0());
  const byId = (id: string) => quiz.find((q) => q.id === id)!;

  it("asks about this period's own numbers: CM I and CM II, with the values shown in the question", () => {
    const q = byId("cm1");
    expect(q.kind).toBe("number");
    expect(q.prompt).toContain("6,000.00");
    expect(q.prompt).toContain("1,520.00");
    expect(q.answer).toBe(3320);
    expect(byId("cm2").answer).toBe(2083.41);
  });

  it("covers contribution margin per unit, break-even, tax, equity ratio and liquidity I", () => {
    expect(byId("cmUnit").answer).toBe(83);
    expect(byId("breakEven").answer).toBe(34928);
    expect(byId("tax").answer).toBe(111.82);
    expect(byId("equityRatio").answer).toBeCloseTo(55.35, 2);
    expect(byId("liquidity1").answer).toBeCloseTo(0.84, 2);
  });

  it("adds conceptual multiple-choice questions whose right answer is the lecture's", () => {
    const q = byId("variableCost");
    expect(q.kind).toBe("choice");
    expect(q.choices![q.answer as number]).toBe("Direct Material Costs");
    const v = byId("cm5");
    expect(v.choices![v.answer as number]).toMatch(/operating/i);
  });

  it("links every question to a glossary term that exists, and gives a worked solution", () => {
    const terms = GLOSSARY.map((g) => g.term);
    for (const q of quiz) {
      expect(terms, q.id).toContain(q.concept);
      expect(q.worked.length, q.id).toBeGreaterThan(10);
    }
  });

  it("only asks what the period's reports can answer: without a balance sheet there are no ratio questions", () => {
    const ids = generateQuiz(p0(["Report11_Contribution Margin.pdf"])).map((q) => q.id);
    expect(ids).toContain("cm1");
    expect(ids).not.toContain("equityRatio");
    expect(ids).not.toContain("liquidity1");
    expect(ids).not.toContain("tax");
  });

  it("skips the tax question when the tax is not 35 % of the result (loss carry-forward), because the question's rule would be wrong", () => {
    const p = p0();
    const row = (p.reports.TNB11.parsed as unknown as { sections: { rows: { label: string; value: number }[] }[] }).sections
      .flatMap((s) => s.rows)
      .find((r) => r.label === "Income Tax")!;
    row.value = 40;
    expect(generateQuiz(p).map((q) => q.id)).not.toContain("tax");
  });

  it("counts short-term loans as well as the overdraft in liquidity I, and skips the ratios on an empty balance sheet", () => {
    const p = p0();
    const bs = p.reports.TNB15.parsed as unknown as {
      liabilities: { label: string; current: number }[];
      total: { liabilities: { current: number } };
    };
    bs.liabilities.find((r) => r.label.startsWith("Short-Term Loans"))!.current = 100;
    expect(generateQuiz(p).find((q) => q.id === "liquidity1")!.answer).toBeCloseTo((10 / (1192.25 + 100)) * 100, 2);
    bs.total.liabilities.current = 0;
    expect(generateQuiz(p).map((q) => q.id)).not.toContain("equityRatio");
  });

  it("is empty for a period with no usable report", () => {
    expect(generateQuiz({ period: 4, company: "Company 2", reports: {} })).toEqual([]);
  });

  it("uses a corrected number: the question changes with Henri's fix", () => {
    const p = p0();
    const steps = (p.reports.TNB10.parsed as unknown as { steps: { label: string; values: number[] }[] }).steps;
    steps.find((s) => s.label === "Direct Material Costs")!.values = [1600, 0, 0, 0, 0, 1600];
    expect(generateQuiz(p).find((q) => q.id === "cm1")!.prompt).toContain("1,600.00");
  });
});

describe("parseAnswer", () => {
  it("reads numbers the way people type them: thousands commas, spaces, units, percent signs, decimal comma", () => {
    expect(parseAnswer("3,320.00")).toBe(3320);
    expect(parseAnswer(" 3320 TEUR ")).toBe(3320);
    expect(parseAnswer("55.35 %")).toBe(55.35);
    expect(parseAnswer("34.927,47")).toBe(34927.47);
    expect(parseAnswer("0,84")).toBe(0.84);
    expect(parseAnswer("−12")).toBe(-12);
    expect(parseAnswer("3 320")).toBe(3320);
    expect(parseAnswer("3,320,000")).toBe(3320000);
    expect(parseAnswer("34.927.470")).toBe(34927470);
    expect(parseAnswer("-5.5")).toBe(-5.5);
  });

  it("returns null for anything that is not one number", () => {
    expect(parseAnswer("")).toBeNull();
    expect(parseAnswer("about 3")).toBeNull();
    expect(parseAnswer("3 4")).toBeNull();
    expect(parseAnswer("-")).toBeNull();
    expect(parseAnswer("1.2.3,4,5")).toBeNull();
  });
});

describe("gradeAnswer", () => {
  const quiz = generateQuiz(p0());
  const q = (id: string) => quiz.find((x) => x.id === id)!;

  it("accepts the right number within the question's tolerance, and shows the worked solution either way", () => {
    const ok = gradeAnswer(q("cm1"), "3,320");
    expect(ok.correct).toBe(true);
    expect(ok.feedback).toContain(q("cm1").worked);
    expect(gradeAnswer(q("cm1"), "3321").correct).toBe(false);
    expect(gradeAnswer(q("tax"), "111.8").correct).toBe(true); // 35 % of 319.48 = 111.818
  });

  it("accepts either neighbouring whole number for the break-even quantity (rounding up is the rule, but 34,927 is a fair slip)", () => {
    expect(gradeAnswer(q("breakEven"), "34928").correct).toBe(true);
    expect(gradeAnswer(q("breakEven"), "34927").correct).toBe(true);
    expect(gradeAnswer(q("breakEven"), "34900").correct).toBe(false);
  });

  it("tells a wrong answer what it was off by, and hints at a unit mix-up (TEUR vs EUR) only when the number is 1,000× off", () => {
    const r = gradeAnswer(q("cm1"), "3,320,000");
    expect(r.correct).toBe(false);
    expect(r.feedback).toContain("mix-up between TEUR");
    // cmUnit's worked solution never mentions TEUR, so a match here comes from the hint itself.
    expect(gradeAnswer(q("cmUnit"), "83000").feedback).toContain("mix-up between TEUR");
    expect(gradeAnswer(q("cmUnit"), "0.083").feedback).toContain("mix-up between TEUR");
    expect(gradeAnswer(q("cmUnit"), "90").feedback).not.toContain("mix-up");
    const off = gradeAnswer(q("cm1"), "3000");
    expect(off.feedback).toContain("you entered 3,000.00");
    expect(off.feedback).toContain("3,320.00");
  });

  it("asks for a number when the input is not one, without counting it as wrong", () => {
    const r = gradeAnswer(q("cm1"), "abc");
    expect(r.correct).toBeNull();
    expect(r.feedback).toMatch(/number/i);
  });

  it("grades multiple choice by index", () => {
    const v = q("variableCost");
    expect(gradeAnswer(v, v.answer as number).correct).toBe(true);
    expect(gradeAnswer(v, ((v.answer as number) + 1) % v.choices!.length).correct).toBe(false);
  });
});

describe("summarize", () => {
  it("counts right answers and lists the concepts to revisit, once each, in question order", () => {
    const quiz = generateQuiz(p0());
    const results = quiz.map((q) => ({ id: q.id, correct: q.id === "cm1" || q.id === "tax" }));
    const s = summarize(quiz, results);
    expect(s.total).toBe(quiz.length);
    expect(s.correct).toBe(2);
    expect(new Set(s.revisit).size).toBe(s.revisit.length);
    expect(s.revisit).not.toContain(quiz.find((q) => q.id === "tax")!.concept);
  });

  it("does not send Henri back to a concept for an answer that could not be read", () => {
    const quiz = generateQuiz(p0());
    const s = summarize(quiz, [{ id: "cm1", correct: null }, { id: "tax", correct: false }]);
    expect(s.revisit).toEqual(["Income tax"]);
    expect(s.correct).toBe(0);
  });
});
