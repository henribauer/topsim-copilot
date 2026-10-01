/**
 * The app's navigation (design guide D1). Mobbin refs for grouped sidebars: Google Ads, Klaviyo, Quicken
 * (docs/mobbin/shell.json). Groups follow what Henri does: look at the result, plan the next period, learn from it,
 * feed in data. The copilot is not a page: it is the docked panel (C3).
 */
export const NAV_GROUPS = [
  { label: null, pages: ["Dashboard", "Analysis"] },
  { label: "Plan", pages: ["Planner", "What-if"] },
  { label: "Learn", pages: ["Quiz", "Glossary"] },
  { label: "Data", pages: ["Import"] },
] as const;

export type Page = (typeof NAV_GROUPS)[number]["pages"][number];

export const PAGES: readonly string[] = NAV_GROUPS.flatMap((g) => g.pages);

/** The label of the group a page sits in: null for the unlabeled first group, undefined for an unknown page. */
export function groupOf(page: string): string | null | undefined {
  return NAV_GROUPS.find((g) => (g.pages as readonly string[]).includes(page))?.label;
}

const TITLES: Record<string, string> = { Import: "Import reports" };

export function pageTitle(page: string): string {
  return TITLES[page] ?? page;
}
