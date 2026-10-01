import { describe, expect, it } from "vitest";
import { NAV_GROUPS, PAGES, groupOf, pageTitle } from "../src/shell/nav";

/**
 * Sidebar structure (design guide D1; Mobbin refs: Google Ads, Klaviyo and Quicken group their sidebar into
 * labelled sections so ~8 items scan as 4 groups). The copilot is no longer a page: it is a docked panel (C3).
 */
describe("sidebar groups", () => {
  it("lists every page exactly once, in the order Henri works through a period", () => {
    const all = NAV_GROUPS.flatMap((g) => g.pages);
    expect(all).toEqual(["Dashboard", "Analysis", "Planner", "What-if", "Quiz", "Glossary", "Import"]);
    expect(new Set(all).size).toBe(all.length);
  });

  it("puts the overview first, with no label of its own, and names the other groups by what Henri does there", () => {
    expect(NAV_GROUPS.map((g) => g.label)).toEqual([null, "Plan", "Learn", "Data"]);
    expect(NAV_GROUPS[0].pages).toEqual(["Dashboard", "Analysis"]);
    expect(NAV_GROUPS[1].pages).toEqual(["Planner", "What-if"]);
  });

  it("has no Copilot page: it is the docked panel", () => {
    expect(PAGES).not.toContain("Copilot");
  });

  it("finds the group of a page", () => {
    expect(groupOf("What-if")).toBe("Plan");
    expect(groupOf("Dashboard")).toBeNull();
    expect(groupOf("Nowhere")).toBeUndefined();
  });
});

describe("pageTitle", () => {
  it("is the page's name, except Quiz which is the Learn page's quiz", () => {
    expect(pageTitle("Analysis")).toBe("Analysis");
    expect(pageTitle("Quiz")).toBe("Quiz");
    expect(pageTitle("Import")).toBe("Import reports");
  });
});
