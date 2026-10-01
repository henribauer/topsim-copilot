import type { BalanceSheetReport } from "../parser/balanceSheet";
import type { ProfitAndLossReport } from "../parser/profitAndLoss";
import type { PeriodFile } from "../store/periodStore";
import { breakEven, cmCascade, type Cascade } from "../analysis/analysis";

/**
 * The quiz after a period (PRD Must 7: "a short quiz on the concepts that drove the result"). Every number
 * question is built from the period's own saved reports (fixes included) and graded in code, so the answer is
 * exact and the worked solution shows the lecture's formula with those numbers. The multiple-choice questions
 * are the lecture's own statements (script p. 27–28). Each question names the glossary term to revisit.
 */
export interface Question {
  id: string;
  /** Glossary term to read when the answer was wrong. */
  concept: string;
  kind: "number" | "choice";
  prompt: string;
  /** number: the expected value; choice: index into `choices`. */
  answer: number;
  choices?: string[];
  /** Largest difference still counted as right (rounding in TOPSIM's two decimals). */
  tolerance: number;
  unit?: string;
  worked: string;
}

const money = (n: number): string => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = (n: number): string => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const round2 = (n: number): number => Math.round(n * 100) / 100;

function step(c: Cascade, label: string): number {
  return c.steps.find((s) => s.label === label)!.total;
}

export function generateQuiz(p: PeriodFile): Question[] {
  const qs: Question[] = [];
  const cascade = cmCascade(p);

  if (cascade) {
    const rev = step(cascade, "Sales Revenue");
    const mat = step(cascade, "Direct Material Costs");
    const prod = step(cascade, "Direct Production Costs");
    const tr = step(cascade, "Transport Costs");
    const cm1 = step(cascade, "Contribution Margin I");
    const fm = step(cascade, "Fixed Material Costs");
    const fp = step(cascade, "Fixed Production Costs");
    const cm2 = step(cascade, "Contribution Margin II");
    qs.push({
      id: "cm1",
      concept: "Contribution margin I–V",
      kind: "number",
      unit: "TEUR",
      prompt: `Period ${p.period}: sales revenue was ${money(rev)} TEUR. The variable costs were direct material ${money(mat)}, direct production ${money(prod)} and transport ${money(tr)} TEUR. What is contribution margin I (TEUR)?`,
      answer: cm1,
      tolerance: 0.05,
      worked: `Contribution margin I = revenue − variable costs = ${money(rev)} − ${money(mat)} − ${money(prod)} − ${money(tr)} = ${money(cm1)} TEUR.`,
    });
    qs.push({
      id: "cm2",
      concept: "Contribution margin I–V",
      kind: "number",
      unit: "TEUR",
      prompt: `Contribution margin I was ${money(cm1)} TEUR; the fixed material costs were ${money(fm)} and the fixed production costs ${money(fp)} TEUR. What is contribution margin II (TEUR)?`,
      answer: cm2,
      tolerance: 0.05,
      worked: `Contribution margin II = CM I − fixed material − fixed production = ${money(cm1)} − ${money(fm)} − ${money(fp)} = ${money(cm2)} TEUR (the report prints this value; the rounded parts differ by a cent).`,
    });

    const be = breakEven(p);
    if (be) {
      qs.push({
        id: "cmUnit",
        concept: "Contribution margin",
        kind: "number",
        unit: "EUR",
        prompt: `The sales price was EUR ${money(be.pricePerUnit)} and the variable cost per unit EUR ${money(be.variableCostPerUnit)}. What is the contribution margin per unit (EUR)?`,
        answer: be.cmPerUnit,
        tolerance: 0.01,
        worked: `Contribution margin per unit = sales price − variable cost per unit = ${money(be.pricePerUnit)} − ${money(be.variableCostPerUnit)} = ${money(be.cmPerUnit)} EUR (script p. 28).`,
      });
      qs.push({
        id: "breakEven",
        concept: "Break-even point",
        kind: "number",
        unit: "units",
        prompt: `The total fixed costs were ${money(be.fixedCosts)} TEUR and the contribution margin per unit EUR ${money(be.cmPerUnit)}. How many units must be sold to break even (whole units; mind TEUR vs EUR)?`,
        answer: be.breakEvenUnits,
        // Rounding up is the rule, but 34,927 (rounded down) is a fair slip — it does not change what was understood.
        tolerance: 1,
        worked: `Break-even quantity = fixed costs ÷ contribution margin per unit = ${whole(be.fixedCosts * 1000)} EUR ÷ ${money(be.cmPerUnit)} EUR = ${money((be.fixedCosts * 1000) / be.cmPerUnit)}, rounded up to ${whole(be.breakEvenUnits)} units, because only whole units can be sold.`,
      });
    }
  }

  const pnl = p.reports.TNB11?.parsed as unknown as ProfitAndLossReport | undefined;
  const ebt = pnl?.sections.flatMap((s) => s.rows).find((r) => r.label === "Earnings before Tax");
  const tax = pnl?.sections.flatMap((s) => s.rows).find((r) => r.label === "Income Tax");
  // The question teaches "35 % of the result". With a loss carried forward the real tax is lower, and the rule
  // in the question would be wrong, so ask only when the report's tax really is 35 %.
  if (ebt && tax && Math.abs(tax.value - ebt.value * 0.35) <= 0.05) {
    qs.push({
      id: "tax",
      concept: "Income tax",
      kind: "number",
      unit: "TEUR",
      prompt: `Earnings before tax were ${money(ebt.value)} TEUR. The tax burden in TOPSIM is 35 % of the result from ordinary activities. How much income tax is due (TEUR)?`,
      answer: tax.value,
      tolerance: 0.05,
      worked: `Income tax = 35 % × earnings before tax = 0.35 × ${money(ebt.value)} = ${money(round2(ebt.value * 0.35))} ≈ ${money(tax.value)} TEUR (handbook 3.5.3).`,
    });
  }

  const bs = p.reports.TNB15?.parsed as unknown as BalanceSheetReport | undefined;
  if (bs) {
    const eq = bs.liabilities.find((r) => r.label === "Equity")?.current;
    const cash = bs.assets.find((r) => r.label === "Cash Balance")?.current;
    const overdraft = bs.liabilities.find((r) => r.label.startsWith("Overdraft"))?.current;
    const shortLoans = bs.liabilities.find((r) => r.label.startsWith("Short-Term Loans"))?.current;
    const totalCapital = bs.total.liabilities.current;
    if (eq !== undefined && totalCapital) {
      const ratio = round2((eq / totalCapital) * 100);
      qs.push({
        id: "equityRatio",
        concept: "Equity ratio",
        kind: "number",
        unit: "%",
        prompt: `The balance sheet shows equity of ${money(eq)} TEUR and a balance sheet total of ${money(totalCapital)} TEUR. What is the equity ratio (in %)?`,
        answer: ratio,
        tolerance: 0.1,
        worked: `Equity ratio = equity capital ÷ total capital = ${money(eq)} ÷ ${money(totalCapital)} = ${money(ratio)} % (script p. 30).`,
      });
    }
    if (cash !== undefined && overdraft !== undefined && shortLoans !== undefined && overdraft + shortLoans > 0) {
      const shortTerm = overdraft + shortLoans;
      const ratio = round2((cash / shortTerm) * 100);
      qs.push({
        id: "liquidity1",
        concept: "Liquidity I",
        kind: "number",
        unit: "%",
        prompt: `Cash is ${money(cash)} TEUR. The short-term liabilities are the overdraft loan (${money(overdraft)}) plus short-term loans (${money(shortLoans)}) TEUR, because both are repaid in the next period. What is liquidity I (in %)?`,
        answer: ratio,
        tolerance: 0.05,
        worked: `Liquidity I = cash ÷ short-term liabilities = ${money(cash)} ÷ ${money(shortTerm)} = ${money(ratio)} % (script p. 29). A value this low means cash covers almost none of what is due next period.`,
      });
    }
  }

  if (cascade) {
    qs.push({
      id: "variableCost",
      concept: "Variable costs",
      kind: "choice",
      prompt: "Which of these costs changes with the quantity produced (a variable cost)?",
      choices: ["Direct Material Costs", "Fixed Production Costs", "Advertising Costs", "Administration Costs"],
      answer: 0,
      tolerance: 0,
      worked: "Direct material is variable: the cost per unit stays the same, so the total moves in proportion to the units (script p. 27). Fixed production costs, advertising and administration are fixed in the report: they do not change when the quantity changes.",
    });
    qs.push({
      id: "cm5",
      concept: "Contribution margin I–V",
      kind: "choice",
      prompt: "What does contribution margin V stand for?",
      choices: ["The net income after tax", "The operating result (operating profit)", "The cash balance at year end", "The revenue after discounts"],
      answer: 1,
      tolerance: 0,
      worked: "Contribution margin V is the operating profit (script p. 28: “Contribution Margin V = operating profit”). It is the Operating Income of the profit and loss statement, before interest and tax.",
    });
    qs.push({
      id: "minPrice",
      concept: "Minimum price approach",
      kind: "choice",
      prompt: "For a short-term decision, what is the lowest price that is still acceptable?",
      choices: ["One that covers the variable costs", "One that covers variable and fixed costs", "One that also earns a profit", "Any price above zero"],
      answer: 0,
      tolerance: 0,
      worked: "Short term, the price must cover the variable costs; medium term variable and fixed costs; long term variable and fixed costs plus profit (script p. 28, minimum price approach).",
    });
  }
  return qs;
}

/**
 * Reads what a person types into a number: "3,320.00", "3320 TEUR", "55.35 %", "34.927,47", "0,84", "−12".
 * Null for anything that is not exactly one number. Rules, in order:
 *  - a unit or % at the end is ignored; a space may only separate thousands ("3 320"), so "3 4" is not a number;
 *  - with both "." and ",", the one that comes last is the decimal mark and the other groups thousands;
 *  - several commas (or dots) can only be thousands separators: "3,320,000" is 3320000, never 3320;
 *  - a single comma followed by exactly three digits is thousands ("3,320"), otherwise a decimal comma ("0,84");
 *  - a single dot is a decimal point, as TOPSIM prints it.
 */
export function parseAnswer(raw: string): number | null {
  let s = raw.trim().replace(/−/g, "-").replace(/\s*(TEUR|EUR|units?|%)\s*$/i, "");
  if (/\s/.test(s)) {
    if (!/^-?\d{1,3}(\s\d{3})+([.,]\d+)?$/.test(s)) return null;
    s = s.replace(/\s/g, "");
  }
  if (!/^-?[\d.,]+$/.test(s)) return null;
  const dots = (s.match(/\./g) ?? []).length;
  const commas = (s.match(/,/g) ?? []).length;
  if (dots && commas) {
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (commas > 1 || dots > 1) {
    s = s.replace(/[.,]/g, "");
  } else if (commas === 1) {
    s = s.length - s.indexOf(",") - 1 === 3 ? s.replace(",", "") : s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) && s !== "" && s !== "-" ? n : null;
}

export interface Grade {
  /** null → the input could not be read, so the question is not counted. */
  correct: boolean | null;
  feedback: string;
}

export function gradeAnswer(q: Question, given: string | number): Grade {
  if (q.kind === "choice") {
    const ok = given === q.answer;
    return { correct: ok, feedback: `${ok ? "Correct." : `Not quite — the answer is “${q.choices![q.answer]}”.`} ${q.worked}` };
  }
  const n = typeof given === "number" ? given : parseAnswer(given);
  if (n === null) return { correct: null, feedback: "Please enter a number, for example 3,320.00." };
  if (Math.abs(n - q.answer) <= q.tolerance) return { correct: true, feedback: `Correct. ${q.worked}` };

  // The classic slip in this game: TEUR vs EUR.
  const factor = q.answer !== 0 && [1000, 1 / 1000].some((f) => Math.abs(n - q.answer * f) <= Math.max(q.tolerance, 0.5) * Math.max(f, 1));
  const hint = factor ? " That looks like a mix-up between TEUR (thousands of euros) and EUR." : "";
  return { correct: false, feedback: `Not quite — you entered ${money(n)}, the answer is ${money(q.answer)}.${hint} ${q.worked}` };
}

/**
 * A hint for a wrong number, shown before the answer is revealed (design guide D34/C5: "Try again" first). It says
 * which way the answer is off and where to look, never the answer itself. Null when there is nothing useful to
 * say: a right answer, input that is not a number, or a multiple-choice question.
 */
export function retryHint(q: Question, given: string | number): string | null {
  if (q.kind !== "number") return null;
  const n = typeof given === "number" ? given : parseAnswer(given);
  if (n === null || Math.abs(n - q.answer) <= q.tolerance) return null;
  const unitSlip = q.answer !== 0 && [1000, 1 / 1000].some((f) => Math.abs(n - q.answer * f) <= Math.max(q.tolerance, 0.5) * Math.max(f, 1));
  if (unitSlip) return "That looks like a mix-up between TEUR (thousands of euros) and EUR. Check the unit in the question.";
  return `Your answer is too ${n < q.answer ? "low" : "high"}. Re-read the question and work through the formula for “${q.concept}” once more.`;
}

export interface Summary {
  total: number;
  correct: number;
  /** Glossary terms of the questions answered wrong, once each, in question order. */
  revisit: string[];
}

export function summarize(quiz: Question[], results: { id: string; correct: boolean | null }[]): Summary {
  const wrong = new Set(results.filter((r) => r.correct === false).map((r) => r.id));
  const revisit: string[] = [];
  for (const q of quiz) if (wrong.has(q.id) && !revisit.includes(q.concept)) revisit.push(q.concept);
  return { total: quiz.length, correct: results.filter((r) => r.correct === true).length, revisit };
}
