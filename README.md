# topsim-copilot

A local browser app that coaches Henri through **TOPSIM – Management Essentials** — the business
simulation played in his course *Managerial Accounting and Controlling* (3rd semester, IBA).
Course starts 2026-10-07; v1 target 2026-10-04.

## What it is

In the simulation you run **mosaic GmbH**, which sells the **SuperBass** headphone. One period =
one fiscal year. The numbers the simulation produces (contribution margins I–V, P&L, balance
sheet, market research …) are exactly the numbers the course teaches. This app connects the two:

- **Import** each period's TOPSIM report (PDF, pasted text, or manual entry) → structured JSON,
  stored as readable Markdown + JSON in the Obsidian vault.
- **Track** KPIs across periods and see the contribution-margin cascade from revenue to CM V.
- **Explain** every number: the concept, the formula filled with this period's real numbers, and
  a link to the matching lecture note. Learning first, not just deciding.
- **Plan** decisions (price, advertising, capacity, hiring, …) with live capacity/cash checks.
- **What-if** scenarios calibrated by each period's actual results.
- **AI copilot** in two modes: *Coach* (asks and explains, Henri decides — the default) and
  *Propose* (suggests a full decision set with reasoning). AI runs through a local `claude` CLI
  subprocess; no API keys, no cloud service.

The app never touches TOPSIM itself: no login, no automation. Henri reads the reports, thinks,
and types his decisions into TOPSIM — the app makes sure he understands what he's typing.

## Status

Early development — see [PROGRESS.md](PROGRESS.md) for the running log and
[PRD.md](PRD.md) for the full requirements. Working so far:

- Contribution Margin (TNB10) parser: header, channels, single-line and wrapped-label rows,
  verified against the real Period 0 report (16 steps incl. CM I–V).
- Design system distilled from 55 Mobbin references ([docs/design-guide.md](docs/design-guide.md)).

## Stack

- TypeScript + React (Vite), Vitest, strict mode
- Tests written first (red → green), one slice at a time
- Domain vocabulary pinned in [CONTEXT.md](CONTEXT.md)

## Development

```bash
npm install        # node_modules lives outside iCloud via symlink (see link-local-deps.sh)
npm run dev        # local dev server
npm test           # vitest
npm run typecheck  # tsc --noEmit
```

Private on purpose: `docs/` contains TOPSIM's copyrighted handbook and sample report text.
