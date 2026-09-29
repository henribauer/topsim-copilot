# topsim-copilot — PRD (confirmed by Henri 2026-09-29, with additions below)

Local browser app that supports Henri through TOPSIM – Management Essentials (company "mosaic GmbH",
headphone "SuperBass", 1 period = 1 fiscal year). Course starts 2026-10-07; target v1 by 2026-10-04.

## Fixed decisions
- Local web app on the Mac, opened in the browser. Solo user (team game, Henri only).
- AI via `claude` CLI subprocess (Max subscription, no API key) — same pattern as atlas.
- Two AI modes, switchable: **Coach** (asks/explains, Henri decides) and **Propose** (suggests full decision set with reasoning).
- Data lives in Obsidian vault `Cowork OS/TOPSIM/` as readable Markdown + JSON.
- No TOPSIM login/browser automation. Henri types the final decisions into TOPSIM himself.
- Stack: TypeScript + React (Vite) in the browser, tests with Vitest. Confirmed 2026-09-29.
- **Learning first** (Henri 2026-09-29: "I want that this App helps me learn the things better"). The app
  teaches the controlling concepts behind each number, not only the numbers. Coach mode is the default.
- **Lecture link** (Henri 2026-09-29: "maybe it could be connected to the atlas app for lecture material and notes").
  Proposed mechanism: read the course's vault folder directly, READ-ONLY: `Class Notes.md` (where Atlas files
  lectures) and the `Class Material/` companion notes. No code coupling to Atlas. Course folder: TBD by Henri.
- **Design**: Mobbin as inspiration (Henri 2026-09-29). Before the first UI slice, a Mobbin research pass
  with app + screen citation per finding, distilled into a numbered design recipe.
- **Report input**: Henri doesn't yet know if reports always come as PDFs. So import accepts PDF, pasted
  text, and manual entry into the same form. Same parsed data shape for all three.

## Must (v1)
1. **Report import** — drop the TOPSIM report PDFs for a period (collective report or 16 individual reports:
   Executive Summary, Market Research, Production, R&D, Inventory, HR, Cost Type/Center/Unit Accounting,
   Contribution Margin, P&L, Cash Accounting, Cash-Flow, Balance Sheet, Business Report, Decision Protocol)
   → parsed into structured JSON per period + a Markdown note in the vault. Manual correction screen for any value the parser misses.
2. **Tracking dashboard** — KPIs across periods: revenue, units, market share, price, contribution margins I–V,
   profit, cash, equity, success value, awareness, quality level, headcount, capacity use, inventory.
3. **Analysis** — contribution-margin cascade, cost-per-unit breakdown, variance (plan vs actual, period vs period),
   break-even, competitor comparison from the market research / business report.
4. **Decision planner (planning model)** — form for every decision area in the handbook: price, advertising, CI,
   customer advisors, bulk-buyer offers, R&D/quality level, purchasing, production lines & capacity,
   operating materials, hiring/firing, loans, dividends. Live check against capacity, workforce, cash/liquidity.
5. **Simulation / what-if** — forecast units, revenue, costs, cash and profit for a draft decision, using the
   handbook's rules of thumb (e.g. €160 ≈ 28.5k units, €140 ≈ 53k; +€30k advertising ≈ +1,200 units;
   +1 advisor ≈ +4.5 % sales), calibrated with each new period's actual results. Compare scenarios side by side.
6. **AI copilot** — chat grounded in the handbook + all imported periods; Coach/Propose toggle; explains
   every number it uses and cites the report/handbook section.
7. **Learning layer** — every KPI and analysis has an "explain" view: the concept (e.g. contribution margin II),
   the formula with this period's real numbers filled in, and a link to the matching lecture note/material.
   After each period: a short quiz on the concepts that drove the result (Coach asks, Henri answers, feedback).
   Glossary of controlling terms, each linked to the handbook section and the lecture note.
8. **Review & strategy** — per-period review note (what we decided, what happened, why, lessons) and a
   strategy page (target position, goals per period) the AI checks decisions against.

## Should
- Export the decision sheet as a checklist to type into TOPSIM.
- Warnings: liquidity shortfall, capacity shortage, price/quality mismatch.

## Could
- Competitor-behavior guesses from market data.
- Charts exported as images for team presentations.

## Won't (for now)
- TOPSIM login or auto-submitting decisions. Multi-user/team sync. Hosted deployment.

## Open questions for Henri
- Which vault course folder is TOPSIM's lecture: `3rd Semester/Accounting and Controlling` or `Planning and Controlling`?
- Atlas side (later, optional): should Atlas also show TOPSIM concepts in its University Recall?
