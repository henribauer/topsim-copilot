import type { Decisions, Opening, Staff } from "./opening";
import { ADMIN_STAFF, PURCHASING_STAFF, RULES, priceFactor, qualityVariableCost, requiredStaff } from "./constants";

/**
 * One period's forecast: Henri's decisions + the opening state -> profit and loss, cash and warnings. The
 * bookkeeping follows the cost structure TOPSIM prints (TNB07-TNB12) and is checked to the cent against the real
 * period 0 (tests/forecastReplay.test.ts). Demand is the only part the manual states just roughly (price table,
 * +4.5 % per advisor, +1,200 units for +30 TEUR advertising), so it is labelled as an estimate.
 * Money is TEUR unless a name says EUR.
 */
export interface Check {
  level: "error" | "warn" | "info";
  text: string;
  /** Handbook section the rule comes from. */
  source?: string;
}

export interface Forecast {
  demand: number;
  sold: number;
  produced: number;
  closingUnits: number;
  lostSales: number;
  revenue: number;
  materialExpenses: number;
  personnel: number;
  depreciation: number;
  otherExpenses: number;
  otherIncome: number;
  stockChange: number;
  operatingIncome: number;
  costOfManufacture: number;
  costOfGoodsSold: number;
  closingStockValue: number;
  /** Cost per cost center, TEUR. */
  centers: Staff;
  workforceEnd: Staff;
  overdraft: number;
  interestOverdraft: number;
  interestLongTerm: number;
  ebt: number;
  tax: number;
  netIncome: number;
  lossCarryforwardEnd: number;
  cashIn: number;
  cashOut: number;
  cashEnd: number;
  receivablesEnd: number;
  /** Production lines available this period (capacity units). */
  capacity: number;
  checks: Check[];
  /** What the numbers rest on, in plain words (shown next to the result). */
  assumptions: string[];
}

const r2 = (x: number): number => Math.round(x * 100) / 100;

export function forecast(o: Opening, d: Decisions): Forecast {
  const checks: Check[] = [];
  const assumptions: string[] = [];
  const err = (text: string, source?: string) => checks.push({ level: "error", text, source });
  const warn = (text: string, source?: string) => checks.push({ level: "warn", text, source });
  const info = (text: string, source?: string) => checks.push({ level: "info", text, source });

  // ---------------------------------------------------------------- production lines
  const scrapped = o.lines.filter((l) => d.scrapLines.includes(l.no));
  const kept = o.lines.filter((l) => !d.scrapLines.includes(l.no));
  const newLineCount = Math.max(0, Math.round(d.newLines));
  if (kept.length + newLineCount === 0) err("At least one production line must remain.", "3.4.2.2");
  const capacity = kept.reduce((s, l) => s + l.capacity, 0) + newLineCount * RULES.lineCapacity.value;

  // ---------------------------------------------------------------- production quantity (lines and staff limit it)
  const staffLimit = d.productionStaff * RULES.unitsPerEmployee.value * (1 + RULES.maxOvertime.value);
  let produced = Math.max(0, d.production);
  if (produced > capacity) {
    err(`The production lines make at most ${capacity.toLocaleString("en-US")} units; ${produced.toLocaleString("en-US")} planned.`, "3.4.2");
    produced = capacity;
  }
  if (produced > staffLimit) {
    err(`${d.productionStaff} production employees make at most ${Math.floor(staffLimit).toLocaleString("en-US")} units even with 20 % overtime.`, "3.4.7");
    produced = Math.floor(staffLimit);
  }
  const regularCapacity = d.productionStaff * RULES.unitsPerEmployee.value;
  const overtimeStaff = Math.max(0, produced / RULES.unitsPerEmployee.value - d.productionStaff);
  if (overtimeStaff > 0) {
    info(`${Math.ceil(produced - regularCapacity).toLocaleString("en-US")} units need overtime (25 % surcharge).`, "3.4.7");
    assumptions.push("Overtime cost = overtime staff x wage x 1.25, from the 25 % surcharge in 3.4.7 (not yet seen in a real report).");
  }

  // ---------------------------------------------------------------- demand
  const ratio = priceFactor(o.price) > 0 ? priceFactor(d.price) / priceFactor(o.price) : 1;
  const advisorFactor = 1 + RULES.advisorEffect.value * (d.advisors - o.advisors);
  const adUnits = RULES.advertisingUnitsPerTeur.value * (d.advertising - o.advertising);
  const demand = Math.max(0, Math.round(o.baseUnits * ratio * advisorFactor + adUnits));
  if (d.price !== o.price || d.advisors !== o.advisors || d.advertising !== o.advertising) {
    assumptions.push(
      "Demand = last period's potential sales x price table (3.1.3) x (1 + 4.5 % per extra advisor, 3.1.5) + 40 units per extra TEUR advertising (3.1.4.1). The manual gives only these rough values; competitors and awareness are not modelled.",
    );
  }
  if (d.price < 140 || d.price > 160) warn("The manual's price table covers EUR 140-160; outside it the forecast extends the nearest slope.", "3.1.3");
  if (Math.abs(d.advertising - o.advertising) > 100) warn("The advertising effect is stated only near the starting budget (300 -> 330 TEUR); far from it the forecast is a guess.", "3.1.4.1");
  if (d.qualityIncrease > 0) info("A higher quality level raises sales in TOPSIM, but the manual gives no size; the forecast leaves demand unchanged.", "3.2");
  if (d.qualityIncrease > RULES.maxQualityStep.value) err("Product quality can rise by at most two levels per period.", "3.2");

  const available = o.finishedUnits + produced;
  const sold = Math.min(demand, available);
  const lostSales = demand - sold;
  if (lostSales > 0) warn(`${lostSales.toLocaleString("en-US")} units of demand cannot be delivered: only ${available.toLocaleString("en-US")} are available.`, "3.3");
  const closingUnits = available - sold;

  const revenue = (sold * d.price) / 1000;

  // ---------------------------------------------------------------- workforce
  const purchasing = requiredStaff(PURCHASING_STAFF, revenue / 1000);
  const admin = requiredStaff(ADMIN_STAFF, revenue / 1000);
  const workforceEnd: Staff = { purchasing, admin, production: d.productionStaff, sales: d.advisors };
  const change = (k: keyof Staff) => workforceEnd[k] - o.workforce[k];
  const hires = (k: keyof Staff) => Math.max(0, change(k)) * RULES.hireCost.value + Math.max(0, -change(k)) * RULES.dismissCost.value;
  const wage = (k: keyof Staff) => workforceEnd[k] * o.wage[k];
  const overtimeCost = overtimeStaff * o.wage.production * (1 + RULES.overtimeSurcharge.value);
  const wages: Staff = {
    purchasing: wage("purchasing"),
    admin: wage("admin"),
    production: wage("production") + overtimeCost,
    sales: wage("sales"),
  };
  const nonSalary = (k: keyof Staff) => wages[k] * RULES.nonSalaryRate.value;

  // ---------------------------------------------------------------- depreciation and line costs
  const linesDepreciation =
    kept.reduce((s, l) => s + (l.remainingTime > 0 ? l.depreciation : 0), 0) +
    (newLineCount * RULES.linePrice.value) / RULES.lineLife.value;
  const linesFixed = kept.reduce((s, l) => s + l.otherFixed, 0) + newLineCount * RULES.lineOtherFixed.value;
  const buildings = o.buildings.purchasing + o.buildings.production + o.buildings.sales + o.buildings.admin;
  const proceeds = scrapped.reduce((s, l) => s + l.nbv * RULES.lineResidual.value, 0);
  const scrapLoss = scrapped.reduce((s, l) => s + l.nbv, 0);

  // ---------------------------------------------------------------- cost centers (TNB08 structure)
  const material = (produced * o.materialPerUnit) / 1000;
  const centers: Staff = {
    purchasing: wages.purchasing + hires("purchasing") + nonSalary("purchasing") + o.buildings.purchasing + o.otherFixed.purchasing,
    production:
      wages.production + hires("production") + nonSalary("production") + o.buildings.production + linesDepreciation + linesFixed + o.otherFixed.production,
    sales:
      wages.sales + hires("sales") + nonSalary("sales") + o.buildings.sales + o.otherFixed.sales + (closingUnits * RULES.storageFinished.value) / 1000,
    admin: wages.admin + hires("admin") + nonSalary("admin") + o.buildings.admin + o.otherFixed.admin,
  };

  // Stock is valued at manufacturing cost (3.3): material + purchasing + production center. Opening stock mixes in at its own value.
  const costOfManufacture = material + centers.purchasing + centers.production;
  const unitCost = produced + o.finishedUnits > 0 ? (costOfManufacture + o.finishedValue) / (produced + o.finishedUnits) : 0;
  const costOfGoodsSold = sold * unitCost;
  const closingStockValue = closingUnits * unitCost;
  if (o.finishedUnits > 0) assumptions.push("Opening stock and new production are valued at their weighted average cost per unit.");
  const stockChange = closingStockValue - o.finishedValue;

  // ---------------------------------------------------------------- profit and loss (total cost method, like TNB11)
  const advertising = d.advertising;
  const transport = (sold * o.transportPerUnit) / 1000;
  const qualityLevel = o.qualityLevel + d.qualityIncrease;
  const rdVariable = (sold * qualityVariableCost(qualityLevel)) / 1000;
  const rdOneOff = (Math.max(0, d.qualityIncrease) * RULES.qualityResearch.value);
  const storage = (closingUnits * RULES.storageFinished.value) / 1000;
  const otherExpenses =
    o.otherFixed.purchasing + o.otherFixed.production + o.otherFixed.sales + o.otherFixed.admin + linesFixed +
    storage + advertising + rdVariable + rdOneOff + transport + scrapLoss;
  const personnel =
    wages.purchasing + wages.admin + wages.production + wages.sales +
    hires("purchasing") + hires("admin") + hires("production") + hires("sales") +
    (wages.purchasing + wages.admin + wages.production + wages.sales) * RULES.nonSalaryRate.value;
  const depreciation = linesDepreciation + buildings;
  const otherIncome = proceeds;
  const operatingIncome = revenue + otherIncome + stockChange - material - personnel - depreciation - otherExpenses;
  const materialExpenses = material;

  // ---------------------------------------------------------------- financing: the overdraft is drawn "just enough" (3.4.9.2)
  const interestLongTerm = o.longTermLoans * o.longTermRate;
  const receiptsNow = revenue * RULES.receiptsCurrentPeriod.value;
  const purchaseOfLines = newLineCount * RULES.linePrice.value;
  const outflowsBeforeTaxAndOverdraftInterest = material + personnel + otherExpenses - scrapLoss + o.loansToRepay + interestLongTerm + purchaseOfLines;
  // scrap loss is a book loss, not a payment; it was added to otherExpenses for the result only.
  let overdraft = 0;
  let tax = 0;
  let interestOverdraft = 0;
  let ebt = 0;
  for (let i = 0; i < 200; i++) {
    interestOverdraft = overdraft * o.overdraftRate;
    ebt = operatingIncome - interestLongTerm - interestOverdraft;
    tax = Math.max(0, ebt - o.lossCarryforward) * RULES.taxRate.value;
    const without = o.cash + receiptsNow + o.receivables + proceeds - outflowsBeforeTaxAndOverdraftInterest - tax - interestOverdraft;
    const next = Math.max(0, RULES.minCash.value - without);
    if (Math.abs(next - overdraft) < 1e-9) {
      overdraft = next;
      break;
    }
    overdraft = next;
  }
  const netIncome = ebt - tax;
  const lossCarryforwardEnd = Math.max(0, o.lossCarryforward - ebt);
  const cashIn = receiptsNow + o.receivables + proceeds + overdraft;
  const cashOut = outflowsBeforeTaxAndOverdraftInterest + tax + interestOverdraft;
  const cashEnd = o.cash + cashIn - cashOut;

  if (overdraft > 0) {
    warn(
      `The cash would fall short by ${r2(overdraft).toLocaleString("en-US")} TEUR. TOPSIM draws an overdraft for it (interest ${r2(interestOverdraft).toLocaleString("en-US")} TEUR) and repays it from next period's cash.`,
      "3.4.9.2",
    );
  }
  if (o.overdraftRate === 0 && overdraft > 0) assumptions.push("No overdraft interest rate is known yet (no overdraft in the reports so far), so its interest shows as 0.");
  if (closingUnits > 0) info(`${closingUnits.toLocaleString("en-US")} units stay in stock (EUR 5 storage cost each per period).`, "3.3");
  if (ebt < 0) info("A loss is carried forward and reduces later taxes.", "3.5.3");
  assumptions.push("Storage cost counts the closing stock; customers' payments follow the 80 / 20 rule; staffing for purchasing and administration follows the manual's graphs, fractions allowed.");

  return {
    demand, sold, produced, closingUnits, lostSales,
    revenue, materialExpenses, personnel, depreciation, otherExpenses, otherIncome, stockChange, operatingIncome,
    costOfManufacture, costOfGoodsSold, closingStockValue,
    centers, workforceEnd,
    overdraft, interestOverdraft, interestLongTerm, ebt, tax, netIncome, lossCarryforwardEnd,
    cashIn, cashOut, cashEnd, receivablesEnd: revenue * (1 - RULES.receiptsCurrentPeriod.value),
    capacity, checks, assumptions,
  };
}
