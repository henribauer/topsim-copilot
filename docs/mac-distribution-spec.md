# Mac distribution and optional Claude setup

Status: **approved by Henri ("go"); implemented 20261008** — verification status, artifacts and open gaps in [mac-distribution-handoff.md](mac-distribution-handoff.md). No commit/push/publication authorized.

## Confirmed scope
- TOPSIM Copilot downloadable through Henri's GitHub once he makes the repository public.
- macOS only for now; Windows is out of scope.
- Include a small setup experience for the Claude CLI.
- Keep all publication actions and repository visibility changes with Henri.

## Proposed defaults for approval
- Package the existing React UI as a standalone Mac app with a bundled runtime and production API, not the Vite development server. Installer: drag-to-Applications DMG.
- Build Apple Silicon and Intel artifacts separately. Verify Apple Silicon locally; Intel execution remains unverified until tested on an Intel Mac or suitable CI runner.
- Default data under the user's Application Support folder. No dependency on Atlas, Obsidian, Henri's folders, source checkout, npm, or system Node. Existing development launcher and vault behavior remain unchanged.
- First launch explains local report storage and offers optional Claude setup. Also make setup accessible later.
- Detect the CLI in native installation and Homebrew paths as well as PATH. Check installation and authenticated status separately; never display credential values or account details.
- Setup provides the official installation command with a copy button and documentation link. Do not silently execute downloaded scripts or install anything.
- Guide the user through terminal-based Claude sign-in, then offer Recheck. Never collect passwords, tokens, or verification codes inside TOPSIM Copilot. Skip is always available; report import, Dashboard, Analysis, Planner, What-if, Quiz, and Glossary remain usable without AI.
- Official macOS installation source verified: https://code.claude.com/docs/en/setup — `curl -fsSL https://claude.ai/install.sh | bash`. Explain internet/account/eligible billing requirements and avoid implying the app includes a Claude subscription.
- Optional handbook/course inputs must come from each user's own files. Do not bundle TOPSIM handbook text, real report fixtures, lecture material, private vault files, or credentials in distributable assets. Do not delete source fixtures/history without approval; source-publication audit is a separate gate.

## Slices and acceptance
1. Portable runtime: shared API behavior for dev/production, bounded inputs, loopback-only or private desktop boundary, own storage defaults, no personal path requirements, full regression suite passing.
2. Optional setup: missing / installed-logged-out / ready / check-failed states; skip/reopen/recheck; copy official installation instructions; clean status output; tests plus visual inspection.
3. Mac packaging: build real DMG, inspect packaged file allowlist, cold-start app with isolated scratch user data, import/save/read back a report, verify setup and non-AI use. No writes to real vault or replacement of installed apps without approval.
4. Release preparation: GitHub workflow and installation guide; publication/license/privacy gate documented. No GitHub writes in this batch.

## Signing limitation
Local ad-hoc signing is not Developer ID signing or notarization. A smooth public first launch requires Apple Developer credentials and notarization; absent those, label the artifact unsigned/unnotarized and accurately document macOS warnings. Never disable Gatekeeper globally.

## Verification and handoff
Use one-test-at-a-time RED/GREEN TDD. Run full tests and typecheck/build, exercise the actual packaged app with isolated storage, inspect screenshots, and report exact results. Keep regenerable dependencies and build output in ~/claude-local. No commit or push without explicit approval.
