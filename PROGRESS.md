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
- Rule: never inline the full handbook/report text; grep/read targeted ranges.
