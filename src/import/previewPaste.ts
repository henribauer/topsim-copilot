import {
  parseContributionMargin,
  type ContributionMarginReport,
} from "../parser/contributionMargin";
import { parseProfitAndLoss, type ProfitAndLossReport } from "../parser/profitAndLoss";
import { parseBalanceSheet, type BalanceSheetReport } from "../parser/balanceSheet";
import {
  parseCostCenterAccounting,
  parseCostTypeAccounting,
  parseCostUnitAccounting,
  type CostCenterReport,
  type CostTypeReport,
  type CostUnitReport,
} from "../parser/costAccounting";
import { parseSectionedReport, SECTIONED_CODES, type SectionedReport } from "../parser/sectionedReport";

/** What the paste screen shows for the current textarea content. */
export type PastePreview =
  | { status: "empty" }
  | { status: "ok"; kind: "cm"; report: ContributionMarginReport }
  | { status: "ok"; kind: "pnl"; report: ProfitAndLossReport }
  | { status: "ok"; kind: "bs"; report: BalanceSheetReport }
  | { status: "ok"; kind: "costType"; report: CostTypeReport }
  | { status: "ok"; kind: "costCenter"; report: CostCenterReport }
  | { status: "ok"; kind: "costUnit"; report: CostUnitReport }
  | { status: "ok"; kind: "sectioned"; report: SectionedReport }
  | { status: "error"; message: string };

export const UNRECOGNISED_MESSAGE =
  "No supported report header found. Supported: TNB01–TNB12, TNB14–TNB16 and TNB19 (TNB07 Cost Type Accounting, TNB08 Cost Center Accounting, TNB09 Cost Unit Accounting, TNB10 Contribution Margin, TNB11 Profit and Loss Statement, TNB15 Balance Sheet and the ten other reports). TNB13 has no sample yet.";

/** Picks the parser from the report code TOPSIM prints at the top of every page. */
export function previewPaste(text: string): PastePreview {
  if (text.trim() === "") return { status: "empty" };
  try {
    if (/^\s*TNB07:/m.test(text)) return { status: "ok", kind: "costType", report: parseCostTypeAccounting(text) };
    if (/^\s*TNB08:/m.test(text)) return { status: "ok", kind: "costCenter", report: parseCostCenterAccounting(text) };
    if (/^\s*TNB09:/m.test(text)) return { status: "ok", kind: "costUnit", report: parseCostUnitAccounting(text) };
    if (/^\s*TNB10:/m.test(text)) return { status: "ok", kind: "cm", report: parseContributionMargin(text) };
    if (/^\s*TNB11:/m.test(text)) return { status: "ok", kind: "pnl", report: parseProfitAndLoss(text) };
    if (/^\s*TNB15:/m.test(text)) return { status: "ok", kind: "bs", report: parseBalanceSheet(text) };
    const code = /^\s*(TNB\d\d):/m.exec(text)?.[1];
    if (code && SECTIONED_CODES.includes(code)) return { status: "ok", kind: "sectioned", report: parseSectionedReport(text) };
    return { status: "error", message: UNRECOGNISED_MESSAGE };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
