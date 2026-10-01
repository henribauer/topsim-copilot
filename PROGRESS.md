# PROGRESS (survives context compaction — read first)

- 2026-09-29: Project dir + git init; vault folder `Cowork OS/TOPSIM/` created (permission given).
- Handbook extracted → docs/handbook.txt (read fully). Period 0 sample reports (Company 2) → docs/p0_reports_sample.txt;
  source PDFs in ~/.hermes/cache/scratch/topsim-reports/Period 0/Company 2/.
- 2026-09-29: PRD.md confirmed by Henri (learning layer, lecture link, Mobbin design pass, flexible import;
  stack TypeScript + React/Vite + Vitest). Commit 858bb2f. No code yet.
- 2026-09-29: Course is **Managerial Accounting and Controlling** (renamed from "Accounting and Controlling").
  Lecture folder: `Cowork OS/University/Universität/3rd Semester/Managerial Accounting and Controlling/`
  (`Class Notes.md`, `Class Material/`) — read-only. Atlas ring.js label updated (atlas a96b30c).
- 2026-09-29: Mobbin design pass done → docs/design-guide.md (55 cited refs, rules D1–D36, 5 open choices). 3 URLs spot-checked: resolve to claimed apps.
- Design choices C1–C5 decided (sidebar, light, docked copilot, waterfall, retry-first quiz) → design-guide.md.
- 2026-09-29: CONTEXT.md written (glossary: simulation world / accounting / market+ops / app terms; canonical words, Avoid-lists). Commit with design guide.
- Next: slice 1 = report import (PDF/paste/manual → same parsed JSON shape + vault note), TDD.
- 2026-09-29: Slice 1a done: scaffolded Vite+React+TS+Vitest; TNB10 Contribution Margin parser via TDD
  (7 tests green, typecheck green): header, channel columns, single-line + wrapped-label rows, and the
  real Period 0 Total table (all 16 steps incl. CM I–V; Margin V is Total-only). Commits bcce146, 7c5e9bd.
  node_modules symlinked to ~/claude-local/topsim-copilot (entry added to link-local-deps.sh).
  Next in slice 1: per-Unit table → paste UI with JSON preview → other reports → PDF extraction → vault note.
- 2026-09-30: Slice 1b done: per-Unit (EUR) table parsed into `report.perUnit` (null if page 2 missing).
  Row loop extracted to `parseSteps`; one table per channel-header row. 10 tests green, typecheck clean;
  mutation check (force both tables to page 1's rows) → 2 red, restored. Repo on GitHub (private):
  henribauer12-source/topsim-copilot, README added.
  Next: slice 1c = paste box in the browser → live JSON preview.
- 2026-09-30: Slice 1c done: Import screen (src/App.tsx + src/styles.css). Sidebar (D1, other sections
  disabled), Paste/PDF/Manual tabs (D24, only Paste live), textarea → live preview: meta chips, Total
  and per-Unit tables (D6 right-aligned tabular figures, aggregate column bold), amber warning if page 2
  missing (D12), red error with text (D11/D35), Show JSON toggle. Logic in src/import/previewPaste.ts
  (empty | ok | error), 3 TDD tests → 13 total green, typecheck clean. Verified in headless Chrome with
  the real P0 paste (32 rows, CM V = 421.01 / 10.53 in the aggregate column).
  Next: slice 1d = other report types (P&L, balance sheet, market research…).
- 2026-09-30: Slice 1d.1 done: TNB11 Profit and Loss Statement parser (src/parser/profitAndLoss.ts):
  wrapped 3-line header, 4 sections (Total Cost / Cost of Sales / Net Income / Appropriation, the last
  continued on page 2), rows = sign + label + TEUR + % of revenue. Handles the PDF split of "+ Increase/
  Decrease of the Stock of Finished Products" around "+ Other Income" (orphan label + later bare numbers)
  and skips repeated page headers/footers. 4 tests; mutation check 4/4 caught. previewPaste now dispatches
  on report code (kind "cm" | "pnl"; unknown → error naming supported reports). UI renders one table per
  P&L section, breakdown rows indented. 18 tests green, typecheck clean; headless Chrome: 29 P&L rows,
  CM still 32. Next: balance sheet (turned out to be TNB15, file Report16), then the remaining report types.
- 2026-10-01: Slice 1d.2 done — TNB15 Balance Sheet parser (`src/parser/balanceSheet.ts`). Shared header
  reader extracted to `src/parser/header.ts` (P&L now uses it). The PDF prints both sides side by side, so
  the text interleaves them and wraps labels around numbers ("Profit/Loss carried" 0.00 0.00 "forward");
  parser tokenises the body into "label words + number pair" chunks and matches them against the fixed
  19-row list (exact, ends-with, starts-with). Totals read from the "Balance Sheet Total" line (4 numbers).
  Sample P0: assets 4,349.91 = equity+liabilities 4,349.91 (prev 3,600.00). Mutation check 6 mutants: 5
  caught first; the page-header skip was dead code for a one-page report → removed. previewPaste `kind:"bs"`,
  `BsReportView` (two sides, amber warning if totals differ), CSS: CM-only bold Total column. 23 tests.
- 2026-10-01: Slice 1d.3 done — cost accounting, one module `src/parser/costAccounting.ts`: TNB07 Cost Type
  (Report8), TNB08 Cost Center (Report9), TNB09 Cost Unit (Report10). TNB07/08 share `readCostGrid` (4 groups,
  labels wrapped over up to 3 lines with numbers on their own line, "/"-joins without space, "(*)" footnote
  kept as `note`, "Total"/"Total Costs" line separate). TNB08 cost centers read from the column header line.
  TNB09 `readSteps` (+ / = / +/- signs, TEUR block with Total+product, EUR per-unit block, "(*)"/"(**)" notes).
  `readHeader` now rejoins titles cut before the Period line ("TNB07: Cost Type" / "Period: 0" / "Accounting")
  only when the read title is a strict prefix of the expected name. Sample P0: costs 5,673.90 = overhead
  1,989.90 + direct 3,684.00; overhead to Purchasing 204.50, Production 1,063.00, R&D 0, Sales 536.20,
  Admin 186.20; full cost 5,578.99 TEUR = 139.47 EUR/unit. Mutation check 11/11 caught. previewPaste kinds
  `costType`/`costCenter`/`costUnit`, views `CostGridView` + `CostStepsView` + `Footnotes`. Shared fixture
  helper `tests/fixtures.ts` `p0Report()`. 30 tests.
- 2026-10-01: Slice 1d.4 done — all remaining report types with one data-driven parser
  `src/parser/sectionedReport.ts`: TNB01 Executive Summary, 02 Market Research, 03 Production, 04 R&D,
  05 Inventory, 06 Human Resources, 12 Cash Accounting, 14 Cash-Flow, 16 Business Report, 19 Decision Protocol.
  Each report is a `LAYOUTS` entry (headings, printed column-header lines → clean names, footnotes, label
  quirks); the reader handles units after labels, +/−/= signs, wrapped labels, blank cells (padded / mapped
  via `sparseRows` for TNB03 "Total"), labels with numbers (`labelPattern`, `labelLines`), label tails below
  values ("Type A Line Nr." … "1"). Values kept as printed (`raw`) + parsed `n`. `readHeader` now joins a title
  split at a hyphen ("Cash-"/"Flow"). 15 of 16 report types parse; TNB13 has no P0 sample yet. previewPaste
  `kind:"sectioned"`, one `SectionedReportView` (checked via renderToStaticMarkup for TNB03/06/19). Mutation
  check on sparse/tail/labelPattern logic 3/3 caught. Pre-commit hook `scripts/secret-scan.sh` (blocks token
  formats; proven with a fake ghp_ token). 43 tests.
- 2026-10-01: Desktop launcher — `~/Desktop/TOPSIM Copilot.app`, same pattern as Pressespiegel.app (AppleScript
  applet → `scripts/start.sh`: start vite on 127.0.0.1:5181 if not running, then open the browser; never
  restarts a running server). Rebuild with `sh scripts/make-launcher.sh` (icon from `scripts/make-icon.py`,
  accent #3b5bdb). Pitfall: editing Info.plist/icon after osacompile breaks the signature → macOS denies the
  iCloud folder ("Operation not permitted"); the script re-signs ad hoc. First launch asks once for iCloud
  Drive access (granted 2026-10-01). Cold start ≈1 s. Log: $TMPDIR/topsim-copilot.log.
- 2026-10-01: Slice 1e done — save imported reports to the vault. `src/store/periodStore.ts` `saveReport`:
  `Cowork OS/TOPSIM/data/period-<n>.json` (all reports of a period keyed by code, each with kind, savedAt,
  raw pasted text, parsed data; re-save replaces) + regenerated `Period <n>.md` note (frontmatter period/
  company/reports, table code/report/date). Atomic writes (tmp + rename). `src/store/saveApi.ts` =
  POST /api/reports, mounted in vite.config.ts; refuses foreign Origins (403) so other websites can't write
  to the vault; 400 with the parser message for non-reports. UI: "Save to vault" primary button (D10) with
  green ✓ / red banner (D11, D23). Vault path override `TOPSIM_VAULT` (used for the e2e run on :5199 with a
  scratch vault: 200 / 403 / 405 as expected). Mutation check 3/3 caught. 51 tests.
- 2026-10-01: Slice 2a done — Dashboard. `src/dashboard/kpis.ts` `dashboardKpis(periods)`: 9 KPIs from TNB01
  (SVI, Total Revenue, Net Income, Market Share, Actual Sales, Return on Sales, Equity, Final Cash, Overdraft),
  raw values as printed, delta latest vs previous (abs, %, favorable by meaning: Overdraft higherIsBetter=false).
  4/4 mutants caught. `loadPeriods` + GET /api/periods (raw text stripped). `src/Dashboard.tsx`: D13 3-col card
  grid, D5 label above numeral, D8 green/red delta, sparkline from 2 periods, empty state → Import. Dashboard is
  now the start section. Verified headless-Chrome screenshot with scratch vault P0+fake P1. 55 tests.
- 2026-10-01: Slice 1g done — PDF + ZIP import. `src/import/pdfText.ts` (pdfjs-dist, rows rebuilt from glyph
  positions, tab between columns): all 16 PDFs parse identically to the pasted text (P&L compared order-free:
  the PDF prints Other Income before Stock Increase). `reportsZip.ts` reads TOPSIM's "download all reports" ZIP
  (`Period n/<company>/Individual reports/ReportN_….pdf`, skips Collective report + __MACOSX). `importFiles.ts`:
  any mix of ZIPs/PDFs → items oldest period first then code, duplicates (code+period) skipped with reason,
  unreadable files last in drop order. `FileImport.tsx`: Upload tab is now the default (drop zone + file list +
  ReportPreview, "Save N reports to vault" saves sequentially). Mutants caught incl. period ordering. E2E in
  headless Chromium with real ~/Downloads/reports.zip → 16/16 saved to scratch vault, 0 console errors. 79 tests.
- Rule: never inline the full handbook/report text; grep/read targeted ranges.
