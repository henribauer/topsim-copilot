# Mac distribution — handoff (20261008)

Spec: [mac-distribution-spec.md](mac-distribution-spec.md) (approved by Henri with "go"). **Nothing committed, pushed or published.**
Implemented by Claude Sonnet 5.5 in three capped runs; this file replaces the earlier in-progress version.

## Verdict

| Slice | Result |
| :-- | :-- |
| 1 Portable runtime | Done. One shared API router for dev server and desktop app; desktop serves page + API over a private `app://topsim` scheme (no network port); bounded bodies; data in the app's own Application Support folder. |
| 2 Optional Claude setup | Done. 4 states (missing / installed-logged-out / ready / check-failed), separate bounded checks, copy-only guidance, skip/reopen/recheck, disclosure. Screenshots below. |
| 3 Mac packaging | Done for **Apple Silicon**: real `.app` + `.dmg`, inspected, packaged app executed in isolation (44/44 checks). **Intel: built and inspected only, never executed** (no Intel Mac, Rosetta not installed). |
| 4 Release preparation | Done (files only): `.github/workflows/mac-build.yml` (artifacts only), README install/signing/rights sections. No GitHub writes. |

Not done / honest gaps: see "Limitations" and "Remaining work".

## Artifacts (all outside iCloud)

| What | Path | Size | SHA-256 |
| :-- | :-- | --: | :-- |
| Apple Silicon DMG | `/Users/henri/claude-local/topsim-copilot/release/TOPSIM-Copilot-0.1.0-arm64.dmg` | 114,689,955 B | `66ede8884e35269d590101069ff22ec14073d6d6b5df1091b46897720143c7a4` |
| Intel DMG (**unverified execution**) | `/Users/henri/claude-local/topsim-copilot/release/TOPSIM-Copilot-0.1.0-x64.dmg` | 121,409,119 B | `e2cc9d36b47e74cc05993c7f2ff90fab7d7fd891e3aa67fd7d0be55b068f5f0e` |
| arm64 app (executed in tests) | `/Users/henri/claude-local/topsim-copilot/release/mac-arm64/TOPSIM Copilot.app` | | |
| x64 app (never executed) | `/Users/henri/claude-local/topsim-copilot/release/mac/TOPSIM Copilot.app` | | |
| Staged runtime files | `~/claude-local/topsim-copilot/stage/` | 2.2 MB | |
| Package inspection reports | `/Users/henri/.hermes/cache/scratch/topsim-mac-e2e/inspect-arm64.json`, `/Users/henri/.hermes/cache/scratch/topsim-mac-e2e/inspect-x64.json` | | |
| Packaged e2e run | `/Users/henri/.hermes/cache/scratch/topsim-mac-e2e/run-2026-10-08T06-51-46-212Z/results.json` | | |

`dist` and `release` in the project are symlinks into `~/claude-local/topsim-copilot/`; `node_modules` likewise (re-run `~/claude/link-local-deps.sh` after installs/builds — done).

Signing: **ad-hoc only** (`Signature=adhoc`, `TeamIdentifier=not set`; `codesign --verify --deep --strict` valid; `spctl` says *rejected* — expected for an app without Developer ID/notarization). Not Developer-ID signed, not notarized, Gatekeeper not touched. arm64 `lipo -archs` = `arm64`, x64 = `x86_64`.

## Package inspection (strict allowlist, `scripts/inspect-package.ts`)

- `app.asar` holds exactly 10 entries: `package.json`, `main.cjs`, `preload.cjs`, `dist/index.html`, `dist/favicon.svg`, `dist/assets/{index-*.js, index-*.css, pdf.worker.min-*.mjs}` — no `node_modules`, docs, fixtures, tests, Mobbin, source maps. Violations: asar 0, Resources 0, whole-tree name scan 0 (x64 the same).
- `Contents/Resources` = `app.asar`, `icon.icns`, `en.lproj` only (no `app-update.yml`, no unpacked folder).
- DMG contents: `Applications, TOPSIM Copilot.app`; the app inside the mounted DMG verifies (`valid`).
- Two real leaks were caught by this inspector during the build and fixed: electron-builder had packed the project's `node_modules` (react-dom, …) into the asar and written `app-update.yml` (updater feed). Fixed by `files: [..., "!**/node_modules/**"]` and `publish: null`.

## Verification evidence

- **Unit/integration:** `npx vitest run` → **340 passed, 1 skipped (341), 46 files** (baseline before this work: 290 passed, 1 skipped, 37 files; +50 tests, +9 files). `npx tsc --noEmit` clean. `npm run build` OK.
- **Packaged arm64 app, isolated:** `ARCH=arm64 npx vite-node scripts/e2e-packaged.ts` → **44/44 passed**. Each launch: scratch `HOME`, `--user-data-dir` under `/Users/henri/.hermes/cache/scratch/topsim-mac-e2e`, `PATH=/usr/bin:/bin:/usr/sbin:/sbin` (no node/npm), no `TOPSIM_*` variables, stand-in `claude` scripts (the real CLI/credentials were never touched), report text read from the private fixtures at run time only. Console/page/request errors captured per scenario; the single console error in the run is the browser noting the app's own 502 answer to the deliberate "ask the copilot without Claude" question (asserted as such).
- **Dev launcher regression (browser, Chrome for Testing, scratch vault):** `npx vite-node scripts/e2e-dev.ts` → 6/6: not desktop, no Setup UI, 16/16 reports saved, all pages zero console errors, foreign Origin 403, 3 MB body 413.
- Stopped only my own test processes (verified none left: `pgrep -f "TOPSIM Copilot"` and `vite --port 5198` both 0).

Checks of the final packaged run:

- PASS PATH given to the app has no node/npm
- PASS S1 setup opens by itself on first launch when Claude is missing
- PASS S1 shows the official install line + docs link + sign-in command
- PASS S1 states account/billing requirement and the Anthropic disclosure
- PASS S1 has no password/token/API-key fields
- PASS S1 does not claim a handbook or lecture folder that is not there
- PASS S1 explains where reports are stored (own userData folder)
- PASS S1 Copy puts exactly the official install line on the clipboard
- PASS S1 'Skip for now' closes setup and remembers it in settings.json
- PASS S1 report saved on disk in the app's own userData folder
- PASS S1 report read back through the app's API
- PASS S1 all 16 reports of the private P0 sample save through the app
- PASS S1 page Planner opens without Claude
- PASS S1 page What-if opens without Claude
- PASS S1 page Quiz opens without Claude
- PASS S1 page Glossary opens without Claude
- PASS S1 page Import opens without Claude
- PASS S1 setup can be reopened later (title is 'Setup' after the first dismissal)
- PASS S1: zero console/page/request errors
- PASS S1 asking the copilot without Claude fails with a plain message
- PASS S1 the only console error since then is the browser noting the app's own 502 answer to that question
- PASS S1 window.open to another site is denied and navigation away is blocked
- PASS S1 page has no Node (require/process) and only the five bridge verbs
- PASS S1 CSP blocks a request to another site
- PASS S1 the app opens no network port of its own (only the test's debug port listens)
- PASS S2 setup does not open by itself again (dismissal remembered)
- PASS S2 the imported report survived the restart
- PASS S2: zero console/page/request errors
- PASS S3 logged-out state: sign in only, no install step
- PASS S3 Recheck keeps the state when nothing changed
- PASS S3: zero console/page/request errors
- PASS S5 check-failed state is shown with both instructions for reference
- PASS S5: zero console/page/request errors
- PASS S4 no setup nag on first launch when Claude is already ready
- PASS S4 the status checks never sent a question (no `-p` call yet)
- PASS S4 ready state, 'Done' button, own sources listed honestly
- PASS S4 only when asking: the copilot call carries reports + the user's own handbook and lecture note
- PASS S4 removing the handbook empties its slot
- PASS S4 after removal the copilot is told there is no handbook (no fake source)
- PASS S4 sign-in details never reached the page (DOM text, API answers)
- PASS S4: zero console/page/request errors
- PASS S6 the TOPSIM ZIP (16 PDFs) is read by pdf.js in the packaged app and saved
- PASS S6: zero console/page/request errors
- PASS No secret from the stand-in auth answer appears in any page text or app log

## Screenshots (viewed; scratch, not in iCloud)

- `/Users/henri/.hermes/cache/scratch/topsim-mac-e2e/run-2026-10-08T06-51-46-212Z/screenshots/01-setup-missing.png`
- `/Users/henri/.hermes/cache/scratch/topsim-mac-e2e/run-2026-10-08T06-51-46-212Z/screenshots/02-import-saved.png`
- `/Users/henri/.hermes/cache/scratch/topsim-mac-e2e/run-2026-10-08T06-51-46-212Z/screenshots/03-dashboard-with-report.png`
- `/Users/henri/.hermes/cache/scratch/topsim-mac-e2e/run-2026-10-08T06-51-46-212Z/screenshots/04-analysis.png`
- `/Users/henri/.hermes/cache/scratch/topsim-mac-e2e/run-2026-10-08T06-51-46-212Z/screenshots/05-planner.png`
- `/Users/henri/.hermes/cache/scratch/topsim-mac-e2e/run-2026-10-08T06-51-46-212Z/screenshots/06-setup-reopened.png`
- `/Users/henri/.hermes/cache/scratch/topsim-mac-e2e/run-2026-10-08T06-51-46-212Z/screenshots/07-dashboard-after-relaunch.png`
- `/Users/henri/.hermes/cache/scratch/topsim-mac-e2e/run-2026-10-08T06-51-46-212Z/screenshots/08-setup-logged-out.png`
- `/Users/henri/.hermes/cache/scratch/topsim-mac-e2e/run-2026-10-08T06-51-46-212Z/screenshots/09-setup-check-failed.png`
- `/Users/henri/.hermes/cache/scratch/topsim-mac-e2e/run-2026-10-08T06-51-46-212Z/screenshots/10-setup-ready.png`
- `/Users/henri/.hermes/cache/scratch/topsim-mac-e2e/run-2026-10-08T06-51-46-212Z/screenshots/11-copilot-answer.png`
- `/Users/henri/.hermes/cache/scratch/topsim-mac-e2e/run-2026-10-08T06-51-46-212Z/screenshots/12-upload-zip-checked.png`
- `/Users/henri/.hermes/cache/scratch/topsim-mac-e2e/run-2026-10-08T06-51-46-212Z/screenshots/13-upload-zip-saved.png`
- Dev launcher: `/Users/henri/.hermes/cache/scratch/topsim-dev-e2e/dev-dashboard.png`

## Commands to reproduce

```bash
cd ~/claude/topsim-copilot
npm test && npm run typecheck                    # 340 passed | 1 skipped
npm run desktop:dist:arm64                       # vite build → stage → electron-builder (ad-hoc) → release/*.dmg
npm run desktop:dist:x64                         # Intel artifact (cross-built on Apple Silicon)
ARCH=arm64 npx vite-node scripts/inspect-package.ts   # allowlist, signature, lipo, mounted DMG (exit 1 on violation)
ARCH=arm64 npx vite-node scripts/e2e-packaged.ts      # runs the packaged .app over CDP with playwright-core; screenshots in scratch
npx vite-node scripts/e2e-dev.ts                       # dev launcher regression (Chrome for Testing)
~/claude/link-local-deps.sh                      # after npm install/builds
```

## What changed (modifications)

New: `src/server/{origin,api}.ts`, `src/setup/{claudeStatus,commands,settings,sources,view}.ts`, `src/Setup.tsx`, `src/desktop/{main,preload,security,allowlist,bridge}.ts`, `scripts/{build-desktop.mjs,electron-builder.config.cjs,adhoc-sign.cjs,inspect-package.ts,e2e-packaged.ts,e2e-dev.ts}`, `.github/workflows/mac-build.yml`, 9 test files (`api, appData, claudeStatus, copilotOptionalSources, desktopSecurity, lectureHardening, origin, packageAllowlist, setupView`), this handoff.
Changed: `vite.config.ts` (four middlewares → one `/api` mount of the shared router), `src/store/saveApi.ts` + `src/copilot/copilotApi.ts` (shared origin check; optional handbook/lecture folder; loose-folder lecture fallback), `src/copilot/context.ts` (no `[Handbook]` source and an explicit note when none was supplied), `src/copilot/claudePath.ts` (`findClaudeBinary`, PATH search), `src/App.tsx` + `src/Copilot.tsx` (Setup button/dialog, honest source wording, privacy line, save message no longer says "TOPSIM/"), `src/styles.css`, `tests/claudePath.test.ts`, `package.json`/lock (electron 44.7.0, electron-builder 26.15.3, esbuild, playwright-core 1.64.0; scripts `desktop:stage`, `desktop:dist:arm64|x64`), `README.md`, `.gitignore` (`dist`, `release` without trailing slash so the symlinks are ignored), `docs/mac-distribution-spec.md` (status), `PROGRESS.md`, `CONTEXT.md`.
Outside the repo: `~/claude/link-local-deps.sh` now links `topsim-copilot/dist` and `topsim-copilot/release`; `npm install` + the script produced extra `node_modules.old-*` folders under `~/claude-local/topsim-copilot/` (safe to delete). Not touched: Atlas, the real vault, `~/Desktop/TOPSIM Copilot.app`, anything in `/Applications`, git history/remote.

## Design notes worth knowing

- Desktop = Electron 44.7.0; the window loads `app://topsim/`, a privileged scheme served from the main process (static files from `app.asar/dist`, `/api/*` through the same `handleApi` as the dev server). No HTTP server exists, so there is nothing to rebind; the debugging port in tests is the test's own flag. Origin `app://topsim` is the only addition to the origin allowlist.
- Hardening: `contextIsolation`, `nodeIntegration:false`, `sandbox`, DevTools off when packaged, permission requests denied, `will-navigate`/`will-redirect` blocked unless `app://topsim`, `window.open` denied (allowlisted https docs/pricing links open in the browser), `<webview>` blocked, CSP (`default-src 'self'`, no remote scripts/connect), preload exposes five verbs (`chooseHandbook`, `clearHandbook`, `chooseLectureFolder`, `clearLectureFolder`, `copyCommand('install'|'login')`) and main validates the sender frame is `app://topsim`.
- Setup auto-opens on first launch only when Claude is not ready; closing it once (Skip for now / Done) is stored in `settings.json`; the sidebar **Setup** button reopens it. If Claude is already ready at first launch nothing nags.
- Claude status never returns CLI output: `auth status` JSON is reduced to one boolean (email/token are dropped inside `claudeStatus.ts`); checks are 5 s (`--version`) and 10 s (`auth status`) and run read-only. Install/login are copy-only commands the user runs in Terminal.
- Handbook = user's own `.txt/.md` (PDF refused with an explanation), copied to `<userData>/sources/handbook.txt`; lecture notes = a user-picked folder (read-only; `Class Notes.md` + `Class Material/*.md` or loose top-level `.md/.txt`; real files only — symlinks and directories are skipped — max 60 notes × 1 MB; unreadable folders yield no notes instead of an error). The handbook is limited to 600 KB and one copilot question to 900 KB of system prompt (macOS argv limit ≈ 1 MiB): beyond that the user gets a 413 message in words instead of an opaque E2BIG. Planner and Glossary do not read the handbook at runtime (no `?raw`/`handbook.txt` import) — they use encoded rules/definitions, which still ship (see rights audit).
- The TDD seams (router + body bound, Claude binary discovery, Claude status, settings/sources, optional copilot sources, desktop security policy, setup view model, package allowlist) were chosen without live confirmation because the run was non-interactive; each was taken red → green (RED output seen before implementing). `Setup.tsx`, `main.ts` and the build scripts are verified through the packaged e2e rather than unit tests.

## Limitations (exact)

1. **Intel build never executed** (built on Apple Silicon; no Rosetta/Intel Mac). Only structure, `lipo`, signature and DMG contents were inspected.
2. **Not signed with Developer ID, not notarized.** `spctl` rejects it. The README's first-launch steps (Control-click → Open / Open Anyway / `xattr -dr com.apple.quarantine`) follow macOS's documented behaviour but were **not walked through on a quarantined, browser-downloaded DMG** on another Mac.
3. The real `claude` CLI was not exercised by the app (stand-ins only, by design: no login/logout/install on this machine). The logged-out contract (`auth status` → `{"loggedIn": false}` or exit 1) is taken from the CLI's documented behaviour; it was not observed against a really logged-out CLI. `claude --version`/`auth status --help` exist on the installed 2.1.289.
4. Native file dialogs ("Choose…") cannot be driven by CDP; their handlers are code-reviewed, `importHandbook`/`readLectureNotes` are unit-tested, and the same IPC path was exercised through the real **Remove** buttons. Opening an allowlisted link in the user's browser (`shell.openExternal`) was not clicked in tests (it would open Henri's browser); `externalLinkAllowed` is unit-tested and `window.open` to another site was verified denied.
5. The Copy button test briefly replaced the macOS clipboard text and restored it afterwards.
6. Electron fuses are at defaults (Electron still honours `--remote-debugging-port` if a user passes it); the Setup dialog has Esc + `aria-modal` but no focus trap; the app icon is the existing launcher icon; bundle id `app.topsimcopilot.mac` is a placeholder; minimum macOS 13 (Electron 44).
7. The copilot prompt still says "Henri" and names the course; user-visible wording is generic, the prompt is not.
8. `npm test` and the e2e scripts read private samples in `docs/` and `tests/fixtures/`; the workflow's test step fails in a repository copy without them.

## Remaining work (needs Henri or a later batch)

- **Publication gates:** source-rights audit of `docs/handbook.txt`, `docs/p0_reports_sample.txt`, `tests/fixtures/p0-reports.zip`, `docs/mobbin/` and the encoded quotes in `src/plan/constants.ts` / glossary; choose a license; decide what stays private; then make fixtures-optional tests (or keep the repo private and distribute DMGs another way). No history was rewritten or deleted.
- Apple Developer ID + notarization (credentials not available here), then a signed DMG replaces the ad-hoc one.
- Run the x64 DMG on an Intel Mac (or the macOS Intel runner via the workflow) and the quarantine walk-through above.
- Generalize the copilot prompt wording; harden Electron fuses; focus trap in the Setup dialog.

## Independent review

Independent read-only review (feature-dev:code-reviewer agent, different context from the builder) of the desktop wrapper against the requirements. **No security findings**: path traversal, IPC sender validation, preload surface, origin check (incl. `Origin: null`), Claude status (fixed argv, no shell, timeouts, only one boolean leaves the module), workflow permissions/secrets/triggers were checked and held up. Four correctness findings, all triaged and fixed:

| # | Finding | Decision |
| :-- | :-- | :-- |
| 1 | Workflow used `runner.temp` in job-level `env` (not an allowed context → GitHub would reject the file) | Fixed: a first step writes `TOPSIM_LOCAL=$RUNNER_TEMP/topsim` to `$GITHUB_ENV`. YAML parses (Ruby), no job-level env; the workflow itself has **not been run** on GitHub (no GitHub writes allowed). |
| 2 | `readLectureNotes` could throw (unreadable folder → `/api/app` 500 → Setup dialog unusable, persisted in settings) and followed symlinks in the structured layout (a linked key file would be sent to Anthropic) | Fixed test-first (`tests/lectureHardening.test.ts`, 3 tests red → green): `lstat` + real files only + size/count caps, all reads inside try/catch. |
| 3 | 5 MB handbook / 40 MB of notes could never fit one `--system-prompt` argv (macOS ≈ 1 MiB) → opaque `spawn E2BIG` | Fixed test-first: 900 KB prompt cap with a clear 413 message before `claude` starts; handbook limit lowered to 600 KB (test pins handbook limit < prompt cap). `--system-prompt-file` exists in the CLI help and would lift the cap — left as a later option (it would write reports to a temp file). |
| 4 | `inspect-package.ts` hard-coded version 0.1.0 | Fixed: reads `package.json`. |

After the fixes both packages were rebuilt, re-inspected and the packaged e2e re-run (numbers above are from that final run).
