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
sh scripts/start.sh          # what the desktop icon runs: start server on :5181 if needed, open browser
sh scripts/make-launcher.sh  # (re)build ~/Desktop/TOPSIM Copilot.app
npm test           # vitest
npm run typecheck  # tsc --noEmit
```

Private on purpose: `docs/` contains TOPSIM's copyrighted handbook and sample report text.

## Mac app (standalone, for people without the dev setup)

> **Unsigned and not notarized.** There is no Apple Developer ID behind these builds, so macOS shows a
> warning on first launch (steps below). The Apple Silicon build was run on one Apple Silicon Mac only; the Intel
> build has been **built but never run**. Not published yet — see "Before this goes public".

### Install

1. Download `TOPSIM-Copilot-<version>-arm64.dmg` (Apple Silicon) or `TOPSIM-Copilot-<version>-x64.dmg` (Intel Mac).
2. Open the DMG, drag **TOPSIM Copilot** onto **Applications**, eject the DMG.
3. First launch: macOS blocks apps that are not notarized. Control-click the app → **Open** → **Open**. If macOS
   offers no Open button, go to System Settings → Privacy & Security, scroll to "TOPSIM Copilot was blocked" and
   choose **Open Anyway**. If it says the app is *damaged*, run
   `xattr -dr com.apple.quarantine "/Applications/TOPSIM Copilot.app"` in Terminal. That removes the download flag from
   this one app; Gatekeeper stays on. (These steps follow macOS's documented behaviour for apps without a notarization
   ticket; they have not yet been walked through on a second Mac with a browser-downloaded DMG.)
4. On first launch a Setup window explains where your data lives and offers the optional Claude setup. **Skip for now**
   is always fine: import, Dashboard, Analysis, Planner, What-if, Quiz and Glossary work without it. Reopen it any time
   with **Setup** in the sidebar.

### Where your data is

Imported reports and settings live in `~/Library/Application Support/TOPSIM Copilot/` (`reports/`, `sources/`,
`settings.json`). Nothing is uploaded when you import, view or analyse reports. Deleting the app does not delete this folder.

### Optional: the AI copilot

The copilot runs through the **Claude Code** command-line tool on your Mac, which needs an internet connection and a
Claude account on a plan that includes Claude Code. TOPSIM Copilot does not include, pay for or sign you into one, and it
never asks for a password, token or code. The Setup window shows the install line from Anthropic's guide
(<https://code.claude.com/docs/en/setup>) to copy into Terminal, then `claude auth login`, then **Recheck**. The app
installs nothing and logs nobody in.

**Privacy:** only when you ask the copilot a question, your saved reports (plus the handbook and lecture notes you added,
if any) are sent to Anthropic through your own Claude account. Nothing is sent otherwise.

### Your own handbook and lecture notes (optional)

The TOPSIM manual and course material are not part of the app. In Setup you can add your own handbook as a plain text file
(PDFs are not read in this version) and a folder of your own `.md`/`.txt` lecture notes. Without them the copilot answers from
your reports; the Planner and Glossary use rules and definitions built into the app and work either way.

### Build it yourself

```bash
npm ci
npm run desktop:dist:arm64     # or desktop:dist:x64 — output: $TOPSIM_LOCAL/release (default ~/claude-local/topsim-copilot/release)
ARCH=arm64 npx vite-node scripts/inspect-package.ts           # strict allowlist + signature + DMG check
ARCH=arm64 npx vite-node scripts/e2e-packaged.ts              # drives the packaged app (needs private report samples in docs/)
```

`.github/workflows/mac-build.yml` builds both architectures as downloadable artifacts only (manual or tag trigger; it
never publishes a release, uses no secrets and does not run on pull requests).

### Before this goes public (blockers, not done)

- **Source rights audit.** `docs/handbook.txt`, `docs/p0_reports_sample.txt` and the test fixtures are TOPSIM/course
  material and live in this private repository. They are **not** in the app (the package is a strict allowlist, checked),
  but making the repository public would publish them. Decide what stays before the visibility change.
- **Encoded rules.** The Planner constants and Glossary contain short quotes and definitions derived from the handbook and
  lecture script. They ship inside the app; their rights status is part of the same audit.
- **No license chosen.** Add one only after the audit.
- **Signing.** Developer ID signing and notarization need an Apple Developer account; until then the warning above stays.
- **Tests need the private samples.** `npm test` reads `docs/*` fixtures, so the workflow's test step fails in a copy of the
  repository that has them removed.
