import { describe, expect, it } from "vitest";
import { attentionItems, dashboardKpis, dashboardLayout } from "../src/dashboard/kpis";
import type { SectionedReport } from "../src/parser/sectionedReport";
import type { PeriodFile } from "../src/store/periodStore";
import { savedP0 } from "./fixtures";

/** Real period 0 with some Executive Summary values replaced (and optionally a new period number). */
function edited(values: Record<string, number>, period = 0): PeriodFile {
  const copy: PeriodFile = JSON.parse(JSON.stringify(savedP0()));
  copy.period = period;
  const report = copy.reports.TNB01.parsed as unknown as SectionedReport;
  for (const s of report.sections)
    for (const r of s.rows) if (r.label in values) r.values[0] = { raw: values[r.label].toLocaleString("en-US", { minimumFractionDigits: 2 }), n: values[r.label] };
  return copy;
}

/**
 * Redesign step 2 (design guide R1): one hero per page. Mobbin refs docs/mobbin/dashboard.json: Deel (hero number,
 * alert strip directly under it), Quicken (hero in its own band, supporting cards below), Copilot Money (each
 * secondary card has one metric so none competes with the hero).
 */
describe("dashboardLayout", () => {
  const layout = dashboardLayout(dashboardKpis([savedP0()]));

  it("leads with the result: net income, revenue and market share are the three headline cards", () => {
    expect(layout.headline.map((h) => h.kpi.label)).toEqual(["Net Income/Net Loss", "Total Revenue", "Market Share"]);
  });

  it("gives each headline card one supporting figure, so nothing needs a card of its own", () => {
    expect(layout.headline.map((h) => h.support?.label)).toEqual(["Return on Sales", "Actual Sales", "Success Value Index"]);
  });

  it("keeps the financial-health numbers together: equity, cash, overdraft", () => {
    expect(layout.health.map((k) => k.label)).toEqual(["Equity", "Final Cash Balance", "Overdraft Loans"]);
  });

  it("shows every one of the nine KPIs exactly once", () => {
    const shown = [...layout.headline.flatMap((h) => [h.kpi, ...(h.support ? [h.support] : [])]), ...layout.health].map((k) => k.label);
    expect(shown.sort()).toEqual(dashboardKpis([savedP0()]).map((k) => k.label).sort());
  });

  it("leaves out a supporting figure the summary does not have, instead of showing a dash", () => {
    const kpis = dashboardKpis([savedP0()]).map((k) => (k.label === "Return on Sales" ? { ...k, points: [] } : k));
    expect(dashboardLayout(kpis).headline[0].support).toBeUndefined();
  });
});

describe("attentionItems (what needs a look, from the latest period only)", () => {
  const items = attentionItems([savedP0()]);

  it("flags the overdraft of period 0: it is repaid out of next period's cash (handbook 3.4.9.2)", () => {
    const o = items.find((i) => i.id === "overdraft")!;
    expect(o.level).toBe("warn");
    expect(o.text).toContain("1,192.25 TEUR");
    expect(o.text).toContain("repaid");
    expect(o.source).toBe("3.4.9.2");
  });

  it("notes that cash sits at the 10 TEUR minimum", () => {
    const c = items.find((i) => i.id === "cash")!;
    expect(c.level).toBe("info");
    expect(c.text).toContain("10.00 TEUR");
    expect(c.source).toBe("3.4.9.2");
  });

  it("lists warnings before notes", () => {
    expect(items.map((i) => i.level)).toEqual(["warn", "info"]);
  });

  it("flags a net loss, which is carried forward against later taxes (3.5.3)", () => {
    const loss = attentionItems([edited({ "Net Income/Net Loss": -50 })]).find((i) => i.id === "loss")!;
    expect(loss.level).toBe("warn");
    expect(loss.text).toContain("-50.00 TEUR");
    expect(loss.source).toBe("3.5.3");
  });

  it("does not call a break-even result a loss", () => {
    expect(attentionItems([edited({ "Net Income/Net Loss": 0, "Overdraft Loans": 0, "Final Cash Balance": 400 })])).toEqual([]);
  });

  it("puts the loss warning before the cash note even though the loss is found second", () => {
    // Order of discovery is overdraft, loss, cash; warnings must still lead.
    const all = attentionItems([edited({ "Net Income/Net Loss": -5 })]);
    expect(all.map((i) => i.id)).toEqual(["overdraft", "loss", "cash"]);
    expect(all.map((i) => i.level)).toEqual(["warn", "warn", "info"]);
  });

  it("is quiet when nothing is wrong: no overdraft, cash well above the minimum, a profit", () => {
    expect(attentionItems([edited({ "Overdraft Loans": 0, "Final Cash Balance": 400 })])).toEqual([]);
  });

  it("only looks at the latest period", () => {
    const old = edited({ "Overdraft Loans": 900 }, 0);
    const now = edited({ "Overdraft Loans": 0, "Final Cash Balance": 400 }, 1);
    expect(attentionItems([old, now])).toEqual([]);
  });

  it("is empty without any saved Executive Summary", () => {
    expect(attentionItems([])).toEqual([]);
  });
});
