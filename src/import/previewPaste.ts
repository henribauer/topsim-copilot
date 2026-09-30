import {
  parseContributionMargin,
  type ContributionMarginReport,
} from "../parser/contributionMargin";

/** What the paste screen shows for the current textarea content. */
export type PastePreview =
  | { status: "empty" }
  | { status: "ok"; report: ContributionMarginReport }
  | { status: "error"; message: string };

export function previewPaste(text: string): PastePreview {
  if (text.trim() === "") return { status: "empty" };
  try {
    return { status: "ok", report: parseContributionMargin(text) };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
