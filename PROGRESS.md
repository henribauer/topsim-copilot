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
  CM still 32. Next: balance sheet (TNB12?), then the remaining report types.
- Rule: never inline the full handbook/report text; grep/read targeted ranges.
