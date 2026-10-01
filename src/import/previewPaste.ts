import {
  parseContributionMargin,
  type ContributionMarginReport,
} from "../parser/contributionMargin";
import { parseProfitAndLoss, type ProfitAndLossReport } from "../parser/profitAndLoss";
import { parseBalanceSheet, type BalanceSheetReport } from "../parser/balanceSheet";

/** What the paste screen shows for the current textarea content. */
export type PastePreview =
  | { status: "empty" }
  | { status: "ok"; kind: "cm"; report: ContributionMarginReport }
  | { status: "ok"; kind: "pnl"; report: ProfitAndLossReport }
  | { status: "ok"; kind: "bs"; report: BalanceSheetReport }
  | { status: "error"; message: string };

export const UNRECOGNISED_MESSAGE =
  "No supported report header found. Supported so far: TNB10 Contribution Margin, TNB11 Profit and Loss Statement, TNB15 Balance Sheet.";

/** Picks the parser from the report code TOPSIM prints at the top of every page. */
export function previewPaste(text: string): PastePreview {
  if (text.trim() === "") return { status: "empty" };
  try {
    if (/^\s*TNB10:/m.test(text)) return { status: "ok", kind: "cm", report: parseContributionMargin(text) };
    if (/^\s*TNB11:/m.test(text)) return { status: "ok", kind: "pnl", report: parseProfitAndLoss(text) };
    if (/^\s*TNB15:/m.test(text)) return { status: "ok", kind: "bs", report: parseBalanceSheet(text) };
    return { status: "error", message: UNRECOGNISED_MESSAGE };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
