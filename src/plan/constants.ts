/**
 * The rules of the simulation that the planner and the what-if use. Every number is a statement of the TOPSIM
 * Participant Manual (docs/handbook.txt); `quote` is the manual's own wording and tests/planConstants.test.ts checks
 * that it is still in the handbook, so a constant cannot drift away from its source. Money is TEUR unless noted.
 */
export interface Rule {
  value: number;
  /** Handbook section, e.g. "3.5.3". */
  section: string;
  /** Verbatim from the manual. */
  quote: string;
}

const rule = (value: number, section: string, quote: string): Rule => ({ value, section, quote });

export const RULES = {
  taxRate: rule(0.35, "3.5.3", "The company's tax burden is 35% on the result from ordinary activities."),
  minCash: rule(10, "3.4.9.2", "The cash balance must be at least EUR 10,000. Just enough is drawn down to reach this cash balance."),
  receiptsCurrentPeriod: rule(0.8, "3.5.1", "80% of the revenues in a period result in immediate payments, 20% of the revenues result in payments in the following period."),
  hireCost: rule(15, "3.4.5", "Each new hire and dismissal in a cost center incurs one-time costs of EUR 15,000 (hiring) and EUR 10,000 (dismissal) at the beginning."),
  dismissCost: rule(10, "3.4.5", "EUR 15,000 (hiring) and EUR 10,000 (dismissal)"),
  nonSalaryRate: rule(0.3, "3.4.6", "Non-salary staff costs are a constant 30% of the respective salary totals of the cost centers"),
  unitsPerEmployee: rule(2000, "3.4.7", "The regular productivity of a production employee is 2,000 headphones per period."),
  maxOvertime: rule(0.2, "3.4.7", "The number of possible overtime hours is limited to a maximum of 20%."),
  overtimeSurcharge: rule(0.25, "3.4.7", "production employees are subject to an overtime surcharge of 25% on wages and salaries that accrue during the overtime period."),
  storageFinished: rule(5, "3.3", "The costs for storing input materials and finished products are EUR 3 and EUR 5 per unit, respectively."),
  lineCapacity: rule(12000, "3.4.2.2", "Type A 1,250 10 12,000 40 25.0"),
  linePrice: rule(1250, "3.4.2.2", "Type A 1,250 10 12,000 40 25.0"),
  lineLife: rule(10, "3.4.2.2", "Type A 1,250 10 12,000 40 25.0"),
  lineOtherFixed: rule(40, "3.4.2.2", "Type A 1,250 10 12,000 40 25.0"),
  lineResidual: rule(0.25, "3.4.2.2", "Type A 1,250 10 12,000 40 25.0"),
  qualityResearch: rule(100, "3.2", "There are one-time research & development costs of EUR 100,000 per level to increase product quality."),
  maxQualityStep: rule(2, "3.2", "Results Increase in product quality → maximum two levels per period"),
  advisorEffect: rule(0.045, "3.1.5", "one additional customer advisor in period 0 could have increased sales by around 4.5%"),
  /** 1,200 more units for 30 TEUR more advertising (330 − 300) → 40 units per TEUR, near the starting point only. */
  advertisingUnitsPerTeur: rule(40, "3.1.4.1", "with a budget of EUR 330,000, approximately 1,200 more headphones could have been sold in period 0."),
  operatingMaterial: rule(3, "3.4.3", "For each headphone you want to produce EUR 3 are incurred for operating materials (e.g., energy)."),
} as const satisfies Record<string, Rule>;

/** Price → units, 3.1.3 (price in EUR, units). Valid at the start of the game; see priceFactor. */
export const PRICE_SALES: [number, number][] = [
  [140, 53000],
  [150, 40000],
  [160, 28500],
];

/**
 * Units the manual's table gives for a price. Between the points: straight line; beyond 140/160: the slope of the
 * nearest segment continues (the manual only shows these three points), never below 0.
 */
export function priceFactor(price: number): number {
  const [[p0, u0], [p1, u1], [p2, u2]] = PRICE_SALES;
  const line = (pa: number, ua: number, pb: number, ub: number) => ua + ((price - pa) * (ub - ua)) / (pb - pa);
  const units = price <= p1 ? line(p0, u0, p1, u1) : line(p1, u1, p2, u2);
  return Math.max(0, units);
}

/** (revenue in MEUR, staff) points of the two graphs in 3.4.5. */
export const PURCHASING_STAFF: [number, number][] = [[2, 2], [4, 2.5], [6, 3], [8, 3.5], [10, 4], [12, 4.5], [14, 5], [18, 6], [22, 7]];
export const ADMIN_STAFF: [number, number][] = [[2, 1], [4, 1.5], [6, 2], [8, 3], [10, 4], [12, 5.5], [14, 7], [18, 9.5], [22, 12]];

/** Staff the manual's graph asks for at a revenue; straight lines between points, end values held outside the graph. */
export function requiredStaff(points: [number, number][], revenueMeur: number): number {
  const first = points[0];
  const last = points[points.length - 1];
  if (revenueMeur <= first[0]) return first[1];
  if (revenueMeur >= last[0]) return last[1];
  const i = points.findIndex(([x]) => x >= revenueMeur);
  const [xa, ya] = points[i - 1];
  const [xb, yb] = points[i];
  return ya + ((revenueMeur - xa) * (yb - ya)) / (xb - xa);
}

/** Variable cost per headphone (EUR) at a quality level, 3.2: 16 at level 1, +2 per level. */
export function qualityVariableCost(level: number): number {
  return 14 + 2 * level;
}
