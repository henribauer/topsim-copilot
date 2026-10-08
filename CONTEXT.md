# TOPSIM Copilot

A local learning companion for Henri's TOPSIM – Management Essentials game: it imports each period's
reports, tracks the numbers, explains the controlling concepts behind them, and helps plan decisions.
The company being played is mosaic GmbH, selling the SuperBass headphone.

## Language

### Simulation world

**Period**:
One round of the game; each period equals one fiscal year.
_Avoid_: round, turn, year

**Report**:
One of the documents TOPSIM produces after a period ends (e.g. P&L, Balance Sheet, Contribution Margin). Reports are the app's source of truth for what actually happened.
_Avoid_: PDF, output

**Decision sheet**:
The set of numbers Henri finally types into TOPSIM for the coming period.
_Avoid_: decision form, input mask

**Success value**:
TOPSIM's overall score, computed from revenue, return on sales, net profit, equity, debt ratio, planning quality, awareness and product quality.
_Avoid_: score, ranking

### Accounting (the course's core)

**Contribution margin (I–V)**:
Five stepped results of subtracting cost blocks from revenue, from CM I (variable material + labour) down to CM V (operating result before financial items). Shown as a waterfall.
_Avoid_: gross margin, CM without a level

**Cost type accounting**:
Report grouping all costs by what they are (material, wages, …).
_Avoid_: expense list

**Cost center accounting**:
Report distributing cost-type totals to the places that caused them.
_Avoid_: overhead allocation

**Cost unit accounting**:
Report computing cost per unit of SuperBass produced.
_Avoid_: unit cost sheet

**Variance**:
Difference between plan and actual, or between two periods.
_Avoid_: delta, deviation

**Break-even**:
The unit volume at which CM covers all fixed costs and profit is zero.

**Return on sales**:
Net profit as a percentage of revenue.
_Avoid_: ROS, margin (unqualified)

**Debt ratio**:
Debt relative to equity/total capital in the balance sheet; feeds the success value.
_Avoid_: leverage, gearing

**Liquidity**:
The cash available to pay obligations; a hard failure mode in the game.
_Avoid_: cash flow (which is the statement), balance

### Market and operations

**Awareness index**:
Combined effect of advertising and corporate identity on how known the company is; drives market share over several periods.
_Avoid_: image, brand

**Market share**:
mosaic GmbH's share of units sold versus competitors.

**Price–sales table**:
Handbook rule of thumb mapping a price to expected unit sales (e.g. €160 ≈ 28,500; €140 ≈ 53,000).
_Avoid_: demand curve

**Product quality level**:
The R&D-funded quality grade of the SuperBass; must match price to keep the price–performance ratio.

**Corporate identity (CI)**:
Communication budget line shaping long-term company image, alongside advertising.
_Avoid_: branding (budget: "CI budget")

**Bulk buyer**:
Special large-order offer that can absorb extra volume.

**Customer advisor**:
Sales staff; each added advisor raises sales by roughly 4.5 %.
_Avoid_: sales rep, consultant

**Production line**:
Capacity unit for producing SuperBass; lines can be bought or sold.
_Avoid_: machine, plant

**Operating materials**:
Materials consumed in production beyond the direct components (lubricants, energy, …).
_Avoid_: supplies

**Headcount**:
Number of employees; changed by hiring/firing decisions.
_Avoid_: staff, workforce size

### The app

**Report import**:
Bringing a period's reports into the app via PDF, pasted text, or manual typing — all three producing the same parsed data.
_Avoid_: upload, parse screen

**Parsed period data**:
The structured JSON for one period extracted from reports; manual corrections amend it, raw reports never edited.
_Avoid_: extraction

**Decision planner**:
Form covering every handbook decision area, with live checks against capacity, workforce and liquidity.
_Avoid_: decision screen

**Scenario**:
A draft decision set fed through the planning model to forecast units, revenue, costs, cash and profit. Scenarios are compared side by side.
_Avoid_: what-if, simulation run

**Planning model**:
The handbook rule-of-thumb engine behind a scenario's forecast, recalibrated with each period's actuals.
_Avoid_: simulator, model (unqualified)

**Coach mode**:
Copilot mode that asks and explains; Henri decides. The default.
_Avoid_: assistant

**Propose mode**:
Copilot mode that suggests a full decision set with reasoning.
_Avoid_: autopilot

**Copilot**:
The collapsible right-hand AI chat panel present on every screen.
_Avoid_: chat, AI panel

**Learning layer**:
The explain views, quizzes and glossary that tie every number back to its controlling concept and lecture note.
_Avoid_: tutorial, help

**Explain view**:
A KPI's concept, its formula with this period's real numbers, and the linked lecture note.
_Avoid_: info popup

**Lecture link**:
Read-only pointer from an app concept to the course folder `3rd Semester/Managerial Accounting and Controlling` in the Obsidian vault.
_Avoid_: Atlas integration (no code coupling)

**Vault note**:
The Markdown file written into `Cowork OS/TOPSIM/` alongside each period's JSON.
_Avoid_: backup file

**Review note**:
Per-period record of what was decided, what happened, why, and the lesson learned.
_Avoid_: retrospective

**Strategy page**:
The target position and per-period goals the copilot checks decisions against.
_Avoid_: goals tab

### Distribution (Mac app)

**Desktop app**:
The standalone macOS build of TOPSIM Copilot (Electron around the same React UI), installed from a DMG; it keeps reports, settings and sources in its own Application Support folder, not in the vault.
_Avoid_: installer, packaged version, native rewrite

**Setup**:
The optional screen (first launch, then the sidebar's Setup button) that explains where data lives, guides the Claude install and sign-in, and takes the user's own sources. Skipping it never blocks the non-AI screens.
_Avoid_: onboarding, wizard, settings

**Claude status**:
One of missing, installed-logged-out, ready or check-failed — installation and sign-in are checked separately, read-only, with time limits; the app never installs Claude or signs anyone in.
_Avoid_: connection state, login state

**Own sources**:
The handbook text file and lecture folder a user supplies themselves; the app never bundles them and says "none added" when absent.
_Avoid_: bundled handbook, course pack

**Encoded rules**:
Handbook numbers and glossary definitions written into the app (planner constants, glossary), as opposed to a copy of the source document; their rights status is part of the publication audit.
_Avoid_: handbook data

**Unsigned build**:
A DMG signed only ad hoc — no Developer ID, not notarized — so macOS shows a first-launch warning; the README documents the steps.
_Avoid_: beta, unofficial
