/**
 * Glossary of the controlling terms behind the TOPSIM reports (PRD Must 7: "Glossary of controlling terms, each
 * linked to the handbook section and the lecture note").
 *
 * Every definition is written from the TOPSIM Participant Manual (docs/handbook.txt) or the lecture script
 * ("Managerial Accounting Script – 0 Front Matter" in the vault) and carries its source. tests/glossary.test.ts
 * checks that each cited handbook section exists as a heading and each script reference occurs in the script,
 * so an entry cannot point at something that is not there. Nothing here comes from general knowledge.
 */
export type Source =
  | { kind: "handbook"; ref: string; title: string }
  /** `ref` is text that occurs in the script file, e.g. "### p. 28". */
  | { kind: "script"; ref: string; title: string }
  /** The TOPSIM report where Henri sees the number, e.g. TNB10. */
  | { kind: "report"; ref: string; title: string };

export interface GlossaryEntry {
  term: string;
  definition: string;
  /** Shown as a formula when the term has one. */
  formula?: string;
  sources: Source[];
}

const hb = (ref: string, title: string): Source => ({ kind: "handbook", ref, title });
const script = (page: number, title: string): Source => ({ kind: "script", ref: `### p. ${page}`, title });
const report = (ref: string, title: string): Source => ({ kind: "report", ref, title });

export const GLOSSARY: GlossaryEntry[] = [
  {
    term: "Contribution margin",
    definition:
      "What remains of the sales price after the variable costs per unit are deducted. It is meant to cover the fixed costs first; once the break-even point is exceeded, what remains is profit. It can be calculated in one step or in several stages, per unit or for the whole quantity.",
    formula: "contribution margin per unit = sales price − variable cost per unit",
    sources: [script(28, "12b Contribution margin accounting (internal view)"), report("TNB10", "Contribution Margin")],
  },
  {
    term: "Contribution margin I–V",
    definition:
      "TOPSIM's multi-stage contribution margin report. It starts at sales revenue and takes cost blocks off step by step: CM I after direct material, direct production and transport costs; CM II after fixed material and fixed production costs; CM III after advertising; CM IV after development costs. Research, sales and administration costs follow, down to CM V, which is the operating profit.",
    formula: "CM I = revenue − direct material − direct production − transport",
    sources: [report("TNB10", "Contribution Margin"), script(28, "Contribution Margin V = operating profit")],
  },
  {
    term: "Break-even point",
    definition:
      "The quantity at which the contribution margins just cover the total fixed costs, so profit is zero. Beyond it, every further unit adds its contribution margin to profit. It follows from the 'mother of all formulas' by setting profit to 0.",
    formula: "break-even quantity = total fixed costs ÷ contribution margin per unit",
    sources: [script(27, "Contribution margin ↔ break-even point ↔ target profit point"), script(28, "once the break-even point has been exceeded, the profit")],
  },
  {
    term: "Mother of all formulas",
    definition:
      "The lecturer's name for the basic cost-volume-profit equation. Rearranged, it gives the contribution margin, the break-even point and the quantity needed for a target profit.",
    formula: "units × sales price = total fixed costs + units × variable cost per unit + profit",
    sources: [script(27, "„mother of all formulas“")],
  },
  {
    term: "Variable costs",
    definition:
      "Costs that change with the quantity produced. The variable cost per unit stays the same when the quantity changes (law of mass production), so the total moves in proportion to units.",
    sources: [script(27, "Classification by reaction to a change in units"), report("TNB10", "Contribution Margin (direct material, direct production, transport)")],
  },
  {
    term: "Fixed costs",
    definition:
      "Costs that do not change when the quantity changes: the total of fixed costs stays the same, so the fixed cost per unit falls as more units are made (law of mass production). This is why a high utilization of the production lines matters for profitability.",
    sources: [script(27, "Classification by reaction to a change in units"), hb("3.4.1", "Production Lines")],
  },
  {
    term: "Direct costs",
    definition:
      "Costs that can be allocated to a cost unit (a product) directly. In the contribution margin report these are the first block: direct material and direct production costs.",
    sources: [script(27, "Allocation to cost unit: direct costs / overhead costs"), report("TNB10", "Contribution Margin")],
  },
  {
    term: "Overhead costs",
    definition:
      "Costs that cannot be allocated to a product directly and are spread over cost centers and then products. Example in TOPSIM: administrative wages and salaries are overhead costs of the Administration cost center, allocated to the products in proportion to sales.",
    sources: [script(27, "Allocation to cost unit: direct costs / overhead costs"), hb("3.5.7.2", "Costs in Administration")],
  },
  {
    term: "Cost",
    definition:
      "The consumption of goods and services, valued in money, for producing outputs. It is not the same as money paid out and not the same as expenditure in financial accounting; its counterpart is performance (the outputs).",
    sources: [script(27, "12a Internal accounting – cost accounting – cost calculation")],
  },
  {
    term: "Cost type accounting",
    definition:
      "Answers 'which kinds of costs were incurred?' — in the script's classification: material, staff, depreciation, interest and others. Together with cost center and cost unit accounting it forms TOPSIM's operational accounting and the basis for planning and monitoring costs.",
    sources: [hb("3.5.7", "Accounting"), script(27, "Cost type accounting"), report("TNB07", "Cost Type Accounting")],
  },
  {
    term: "Cost center accounting",
    definition:
      "Answers 'where were the costs incurred?'. In TOPSIM the cost centers are Purchasing, Production, Sales and Administration; for example the TEUR 30 yearly building depreciation is split 10 % / 60 % / 20 % / 10 % across them.",
    sources: [hb("3.5.7.1", "Depreciation for Buildings"), hb("3.5.7", "Accounting"), report("TNB08", "Cost Center Accounting")],
  },
  {
    term: "Cost unit accounting",
    definition:
      "Answers 'what did the costs create?'. A cost unit is the product, service or order that 'carries' the costs to the customer; here it is the SuperBass headphone. The report shows the cost per unit.",
    sources: [script(27, "Cost unit: product, service, order"), hb("3.5.7", "Accounting"), report("TNB09", "Cost Unit Accounting")],
  },
  {
    term: "Minimum price approach",
    definition:
      "How low a price may go depends on the time horizon: in the short term it must cover the variable costs; in the medium term variable and fixed costs; in the long term variable and fixed costs plus profit.",
    sources: [script(28, "Minimum price approach")],
  },
  {
    term: "Depreciation",
    definition:
      "Spreads the acquisition value of an asset over its running time. Production lines are depreciated straight-line and can still be used once fully depreciated. Buildings are depreciated by TEUR 30 per period.",
    formula: "yearly depreciation = acquisition value ÷ running time",
    sources: [hb("3.4.1", "Production Lines"), hb("3.5.7.1", "Depreciation for Buildings")],
  },
  {
    term: "Overdraft loan",
    definition:
      "If the available cash does not cover all payments, the bank automatically grants a current-account credit so the company is not insolvent. Just enough is drawn to reach the minimum cash balance of EUR 10,000. Interest is due in the current period and the overdraft is repaid automatically in the next. Its rate rises once the company controls its liquidity itself.",
    sources: [hb("3.4.9.2", "Overdraft Loans"), hb("3.5.2", "Loans"), report("TNB11", "Profit and Loss Statement (interest for overdraft loan)")],
  },
  {
    term: "Short-term loan",
    definition:
      "A loan you decide on each period as needed. It lasts one period: it bears interest in the current period and is repaid automatically in the following one.",
    sources: [hb("3.5.2.1", "Short-term Loans")],
  },
  {
    term: "Income tax",
    definition:
      "The tax burden is 35 % of the result from ordinary activities. Losses are carried forward and offset against later pre-tax profit until a positive balance remains, which is then taxed. Tax is paid in the current period.",
    formula: "income tax = 35 % × earnings before tax",
    sources: [hb("3.5.3", "Taxes"), report("TNB11", "Profit and Loss Statement")],
  },
  {
    term: "Retained earnings",
    definition:
      "mosaic GmbH does not distribute profits. The net profit of a period stays in the company and is shown cumulatively as profit carried forward in the balance sheet.",
    sources: [hb("3.5.4", "Dividends"), report("TNB15", "Balance Sheet")],
  },
  {
    term: "Trade receivables",
    definition:
      "Money customers still owe at the end of a period. 80 % of a period's revenue is paid immediately and 20 % in the following period (large customers pay the whole invoice at once). The outstanding part appears in the balance sheet under this name.",
    sources: [hb("3.5.1", "Payment Behavior of Customers"), report("TNB15", "Balance Sheet")],
  },
  {
    term: "Success value",
    definition:
      "TOPSIM's overall performance score for the company, determined every period. It is made up, with different weights, of total revenue, return on sales, net profit, equity, debt ratio, quality of planning, awareness and product quality.",
    sources: [hb("3.5.5", "Success Value"), script(30, "13b Indicators of success and stability")],
  },
  {
    term: "Return on sales",
    definition: "How much profit is left per euro of revenue.",
    formula: "return on sales = profit ÷ sales (turnover)",
    sources: [script(30, "13b Indicators of success and stability")],
  },
  {
    term: "Return on equity",
    definition: "How much profit the owners' capital earned, measured against the equity at the start of the period.",
    formula: "return on equity = profit ÷ equity (start of period)",
    sources: [script(30, "13b Indicators of success and stability")],
  },
  {
    term: "Return on total capital",
    definition:
      "How well all capital, owners' and lenders', earned money: profit plus the interest paid, measured against the total capital at the start of the period.",
    formula: "return on total capital = (profit + interest paid) ÷ total capital (start of period)",
    sources: [script(30, "13b Indicators of success and stability")],
  },
  {
    term: "Equity ratio",
    definition: "The share of the company's capital that belongs to the owners.",
    formula: "equity ratio = equity capital ÷ total capital",
    sources: [script(30, "13b Indicators of success and stability"), report("TNB15", "Balance Sheet")],
  },
  {
    term: "Debt ratio",
    definition: "The share of the company's capital that is borrowed. It is one of the factors in the success value.",
    formula: "debt ratio = loan capital ÷ total capital",
    sources: [script(30, "13b Indicators of success and stability"), hb("3.5.5", "Success Value")],
  },
  {
    term: "Liquidity I",
    definition: "Cash liquidity: can the cash on hand and in banks pay the short-term liabilities? The old commercial rule says liquidity first, profitability second.",
    formula: "liquidity I = cash ÷ short-term liabilities",
    sources: [script(29, "13a Indicators of liquidity")],
  },
  {
    term: "Liquidity II",
    definition: "Adds the receivables to the cash: can cash plus what customers owe pay the short-term liabilities?",
    formula: "liquidity II = (cash + receivables) ÷ short-term liabilities",
    sources: [script(29, "13a Indicators of liquidity")],
  },
  {
    term: "Liquidity III",
    definition: "Adds the stocks as well: cash, receivables and stocks against the short-term liabilities.",
    formula: "liquidity III = (cash + receivables + stocks) ÷ short-term liabilities",
    sources: [script(29, "13a Indicators of liquidity")],
  },
  {
    term: "Cash flow",
    definition:
      "The cash movements of a period, classified into operating cash flow, cash flow from investments and cash flow from financing. The direct method builds it from the internal cash reports; the indirect method from the balance sheet and the profit and loss account. Both give the same result, but the external statements are aggregated and cannot be traced back to the detail.",
    sources: [script(26, "11b Liquidity: cash flow")],
  },
  {
    term: "Market share",
    definition: "Your share of what the whole market sold. Related: the sales quota compares what you sold with what you offered.",
    formula: "market share = sales volume ÷ market volume",
    sources: [{ kind: "script", ref: "Market share = sales volume / market volume", title: "Core formulas to remember (front matter)" }],
  },
  {
    term: "Price-sales table",
    definition:
      "The manual's picture of price sensitivity: at the starting price of EUR 150 about 40,000 units sell; at EUR 160 (+6.7 %) about 28,500; at EUR 140 (−6.7 %) about 53,000. It ignores the effect of product quality, so a big price change has significant business consequences.",
    sources: [hb("3.1.3", "Pricing Policy")],
  },
  {
    term: "Advertising",
    definition:
      "Classic advertising (social media, banners, online spots). More spend usually raises demand, strongest in the period it is placed but with an effect over several periods. The effect has decreasing marginal utility. The starting budget is EUR 300,000; with EUR 330,000 about 1,200 more headphones could have been sold in period 0.",
    sources: [hb("3.1.4.1", "Advertising"), report("TNB10", "Contribution Margin (advertising costs)")],
  },
  {
    term: "Decreasing marginal utility",
    definition: "Each additional euro of the same spend brings less extra effect than the one before. The manual names it for advertising and corporate identity: very high spending shows no clear additional effect, while too little is hardly noticed.",
    sources: [hb("3.1.4.1", "Advertising"), hb("3.1.4.2", "Corporate Identity")],
  },
  {
    term: "Corporate identity",
    definition:
      "A communication tool that raises awareness across products and markets in the long term, while advertising works short-term and per product and market. About EUR 125,000 is appropriate for a company like mosaic GmbH. It is added to the decisions as the simulation progresses.",
    sources: [hb("3.1.4.2", "Corporate Identity")],
  },
  {
    term: "Awareness index",
    definition:
      "The customers' general awareness of your company, set every period as an index. It directly influences your market share. Corporate identity spending is the major factor, advertising also counts; awareness can fall if both are cut significantly.",
    sources: [hb("3.1.4.3", "Awareness"), hb("3.5.5", "Success Value")],
  },
  {
    term: "Bulk buyer",
    definition:
      "An extra sales opportunity: a buyer sets price and maximum quantity per company, delivery has priority over the online store, all distribution costs are borne by the bulk buyer, and online demand is unaffected. The contribution margins are usually lower than in the online store.",
    sources: [hb("3.1.6", "Additional Sales Opportunity: Bulk Buyer")],
  },
  {
    term: "Operating materials",
    definition: "Energy and similar inputs: EUR 3 per headphone produced. They are procured automatically and are always available in the needed amount.",
    sources: [hb("3.4.3", "Operating Materials")],
  },
];

/** Lower case, and "35 %" = "35%": the texts print a space before % that nobody types. */
const norm = (s: string): string => s.toLowerCase().replace(/\s+%/g, "%");

/** Name matches first (exact, then prefix, then contained), then definition matches; empty query → everything. */
export function searchGlossary(query: string): GlossaryEntry[] {
  const q = norm(query.trim());
  if (q === "") return GLOSSARY;
  const rank = (e: GlossaryEntry): number => {
    const name = norm(e.term);
    if (name === q) return 0;
    if (name.startsWith(q)) return 1;
    if (name.includes(q)) return 2;
    if (norm(e.definition).includes(q) || norm(e.formula ?? "").includes(q)) return 3;
    return 4;
  };
  return GLOSSARY.map((e) => ({ e, r: rank(e) }))
    .filter((x) => x.r < 4)
    .sort((a, b) => a.r - b.r)
    .map((x) => x.e);
}

/** The letters that start at least one term, in order, with how many terms each holds (the A–Z strip, D32). */
export function letterIndex(entries: GlossaryEntry[]): { letter: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    const l = e.term[0].toUpperCase();
    counts.set(l, (counts.get(l) ?? 0) + 1);
  }
  return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([letter, count]) => ({ letter, count }));
}

/** Terms starting with a letter, alphabetically. */
export function entriesForLetter(entries: GlossaryEntry[], letter: string): GlossaryEntry[] {
  return entries.filter((e) => e.term[0].toUpperCase() === letter.toUpperCase()).sort((a, b) => a.term.localeCompare(b.term));
}
