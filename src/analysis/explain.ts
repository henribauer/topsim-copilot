import type { BreakEven, Cascade, CascadeStep } from "./analysis";

/**
 * "Explain" views (PRD Must 7): the concept, the formula, and the formula with THIS period's numbers filled in.
 * Concept texts come from the lecture script (p. 27–28) and the TOPSIM manual (3.5.7); the numbers come from
 * the saved report, so a number Henri corrected shows up corrected.
 */

/** 1,234.5 → "1,234.50": numbers as TOPSIM prints them. */
const money = (n: number): string => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = (n: number): string => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

/** Which printed steps make up each contribution margin: starting point, then the costs taken off. */
const CM_DEFINITION: Record<string, { from: string; minus: string[]; concept: string }> = {
  "Contribution Margin I": {
    from: "Sales Revenue",
    minus: ["Direct Material Costs", "Direct Production Costs", "Transport Costs"],
    concept:
      "What each sale leaves after the variable costs: the material, production and transport costs that rise and fall with the quantity. It is the amount that must cover all the fixed costs and then the profit (script p. 28: the contribution margin per unit is sales price minus variable cost per unit).",
  },
  "Contribution Margin II": {
    from: "Contribution Margin I",
    minus: ["Fixed Material Costs", "Fixed Production Costs"],
    concept:
      "Contribution margin I after the fixed costs of purchasing and production. Fixed costs stay the same when the quantity changes (script p. 27, law of mass production), so a higher utilization of the production lines spreads them over more units.",
  },
  "Contribution Margin III": {
    from: "Contribution Margin II",
    minus: ["Advertising Costs"],
    concept: "What is left after advertising: the result of the product once the marketing spend of the period is paid for.",
  },
  "Contribution Margin IV": {
    from: "Contribution Margin III",
    minus: ["Development Costs"],
    concept: "What is left after the development costs (R&D) of the period.",
  },
  "Contribution Margin V": {
    from: "Contribution Margin IV",
    minus: ["Research Costs", "Sales Costs", "Administration Costs"],
    concept:
      "The operating result: contribution margin IV after research, sales and administration costs. The script puts it as 'Contribution Margin V = operating profit' (p. 28); it is the Operating Income in the profit and loss statement.",
  },
};

export interface CmExplanation {
  title: string;
  concept: string;
  /** Symbolic: "Contribution Margin I − Fixed Material Costs − …". */
  formula: string;
  /** The same with this period's numbers, ending in TOPSIM's printed result. */
  worked: string;
  /** The arithmetic reproduces the printed result (within rounding). */
  checks: boolean;
  /** Set when it does not: how far apart they are. */
  note: string | null;
}

export function explainCmStep(cascade: Cascade, label: string): CmExplanation | null {
  const def = CM_DEFINITION[label];
  const find = (l: string): CascadeStep | undefined => cascade.steps.find((s) => s.label === l);
  const target = find(label);
  const start = def && find(def.from);
  const costs = def?.minus.map(find);
  if (!def || !target || !start || !costs || costs.some((c) => !c)) return null;

  // TOPSIM calculates with unrounded values and prints two decimals, so the printed parts can differ from the
  // printed result by a cent or two. Up to 0.05 is rounding; more means a number is wrong (e.g. misread).
  const computed = [start, ...(costs as CascadeStep[])].reduce((sum, s, i) => (i === 0 ? s.total : sum - s.total), 0);
  const gap = Math.round((computed - target.total) * 100) / 100;
  const checks = Math.abs(gap) <= 0.05;
  return {
    title: label,
    concept: def.concept,
    formula: [def.from, ...def.minus].join(" − "),
    worked: `${[start, ...(costs as CascadeStep[])].map((s) => money(s.total)).join(" − ")} = ${money(target.total)} ${cascade.unit}`,
    checks,
    note: checks ? null : `The printed parts do not add up to the printed result: they give ${money(computed)}, the report says ${money(target.total)} (${money(Math.abs(gap))} apart). One of the numbers may be misread.`,
  };
}

export interface BreakEvenExplanation {
  concept: string;
  formula: string;
  lines: { label: string; formula: string; worked: string }[];
}

/** The break-even point, one line per step, in the order the script derives it (p. 27). */
export function explainBreakEven(b: BreakEven): BreakEvenExplanation {
  const exact = (b.fixedCosts * 1000) / b.cmPerUnit;
  return {
    concept:
      "The quantity at which the contribution margins just cover all fixed costs, so profit is zero. It follows from the 'mother of all formulas' (units × sales price = total fixed costs + units × variable cost per unit + profit) with profit = 0. In TOPSIM's report the variable costs are the three blocks above contribution margin I; every cost block below it counts as fixed.",
    formula: "break-even quantity = total fixed costs ÷ contribution margin per unit",
    lines: [
      {
        label: "Contribution margin per unit",
        formula: "price − variable cost per unit",
        worked: `${money(b.pricePerUnit)} − ${money(b.variableCostPerUnit)} = ${money(b.cmPerUnit)} EUR per unit`,
      },
      {
        label: "Fixed costs",
        formula: "all costs below contribution margin I",
        worked: `${b.fixedParts.map(money).join(" + ")} = ${money(b.fixedCosts)} TEUR`,
      },
      {
        label: "Break-even quantity",
        formula: "fixed costs ÷ contribution margin per unit, rounded up to a whole unit",
        worked: `${whole(b.fixedCosts * 1000)} ÷ ${money(b.cmPerUnit)} = ${money(exact)} → ${whole(b.breakEvenUnits)} units`,
      },
      {
        label: "Margin of safety",
        formula: "units sold − break-even quantity",
        worked: `${whole(b.unitsSold)} − ${whole(b.breakEvenUnits)} = ${whole(b.safetyUnits)} units (${money(b.safetyPct)} % of the units sold)`,
      },
    ],
  };
}

export type BarType = "increase" | "decrease" | "total";

export interface Bar {
  label: string;
  type: BarType;
  /** The bar floats between these two levels (TEUR). */
  from: number;
  to: number;
  value: number;
  /** Level where the dashed connector from the previous bar meets this one. */
  connectFrom: number;
}

/**
 * The cascade as floating bars (design guide D14, ref 16): revenue rises from 0; every cost hangs down from the
 * running level; every contribution margin is a "total" bar standing on 0 at its own printed value, and the
 * running level continues from it (so rounding in the report never makes the chart drift).
 */
export function waterfall(cascade: Cascade): Bar[] {
  const bars: Bar[] = [];
  let level = 0;
  for (const s of cascade.steps) {
    if (s.kind === "revenue") {
      bars.push({ label: s.label, type: "increase", from: 0, to: s.total, value: s.total, connectFrom: level });
      level = s.total;
    } else if (s.kind === "cost") {
      const to = Math.round((level - s.total) * 100) / 100;
      bars.push({ label: s.label, type: "decrease", from: level, to, value: s.total, connectFrom: level });
      level = to;
    } else {
      bars.push({ label: s.label, type: "total", from: 0, to: s.total, value: s.total, connectFrom: s.total });
      level = s.total;
    }
  }
  return bars;
}
