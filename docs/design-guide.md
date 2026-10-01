# topsim-copilot — Design Guide

Design research for a local, single-user desktop web app that supports Henri through TOPSIM – Management Essentials (course: Managerial Accounting and Controlling). Calm, focused, data-dense study tool — not gamified. Researched via Mobbin MCP against real, currently-live web apps.

## MCP status

**Worked.** All 16 `search_screens` calls (platform: `web`, mode: `deep`) returned successfully with images and metadata — no errors, no empty results, no auth prompts. Every reference below is a screen Mobbin actually returned and I visually inspected (thumbnail shown in tool output). No flows or sections searches were run — screens search alone gave sufficient coverage for all 8 target screens.

## References

| # | App | Screen / flow (as Mobbin labels it) | What to take |
|---|-----|----------------------------------------|--------------|
| 1 | Docusign | [Upload a Document and Add Envelope Recipients](https://mobbin.com/screens/0d8fe187-cbbb-460c-a156-d8bd87363a00) | Drag-drop zone + "Upload" button that opens a cloud-source dropdown (Desktop/Box/Dropbox/Drive/OneDrive) |
| 2 | Gusto | [Add document](https://mobbin.com/screens/1bc77eb7-47f6-41ef-abbd-3bba54098926) | Compact upload zone with "or drop file" secondary text, uploaded file shown as a chip row |
| 3 | Chatbase | [Files (Data sources)](https://mobbin.com/screens/591d4424-f134-42bb-954f-2f8d1b188936) | Multi-file drop zone above a persistent file list with checkboxes, size, and a "Retraining required" banner |
| 4 | Supabase | [Add data to table](https://mobbin.com/screens/aba1ad77-9a4d-4924-a8f7-bd8e1a8e943e) | "Upload CSV" / "Paste text" tabs at top of the same modal, then a configure + preview-rows step before import |
| 5 | Klaviyo | [Import email template](https://mobbin.com/screens/f4bb9ae3-038f-4ca2-a317-8673ca519d6c) | "Upload HTML file" / "Paste HTML" tabs — same paste-vs-upload pattern for a different content type |
| 6 | Melio | [Review vendor details](https://mobbin.com/screens/5b56a18f-2fd3-4f71-9884-434f1a73549b) | Post-import review table, every cell editable inline, "Show only vendors with errors" toggle, required columns marked with `*` |
| 7 | Remote | [Review your team's time off data](https://mobbin.com/screens/ab52924c-333f-42fb-bc19-659aa03720e0) | Error rows get a red icon + inline error text + dropdown fix control right in the cell |
| 8 | Attio | [Upload File → Map Columns → Review Values → Preview Import](https://mobbin.com/screens/60a1cfe5-3788-49e3-b3ae-3da62a33f7ee) | 4-step numbered stepper header; "Needs review" count with inline correction fields |
| 9 | Twenty | [Upload File → Match Columns → Validate Data](https://mobbin.com/screens/8429b076-1864-4c32-b237-7933be9769ae) | Red-outlined invalid cell with an editable popover; "Show only rows with errors" toggle |
| 10 | Whop | [Stats](https://mobbin.com/screens/10310940-4573-4c35-8501-cecd2352db36) | Grid of small-multiple KPI cards, each with value, green `+Δ`, and inline sparkline |
| 11 | Xero | [Analytics graphs dashboard](https://mobbin.com/screens/36f8dc4f-34f7-43bb-92a6-b6f4c4735622) | 3-column widget grid, prior-period comparison line with red/green % callout on hover |
| 12 | Xero | [Analyse](https://mobbin.com/screens/8fe07dbf-a85a-4e83-8432-5988eb146595) | Variance table: metric, value, direction arrow, "vs prior month" delta text, colored risk tag (Medium/High) |
| 13 | TheyDo | [Metrics](https://mobbin.com/screens/779e91bf-b643-4017-8535-22cb38b5ddbd) | Metrics list table: average value / last data point / % change vs a fixed prior week, colored red/green |
| 14 | Midday | [Dashboard](https://mobbin.com/screens/cd6cc0cc-b330-4401-a816-fbb9f75baaaa) | Stat-card grid (burn rate, revenue, expenses, P&L) each with its own small trend chart |
| 15 | Plain | [Reporting overview](https://mobbin.com/screens/45cce71c-0e09-479d-89a9-498ed2d77be7) | Small-multiple charts with a bold headline number + "last 7 days" comparison line beneath the chart title |
| 16 | Zoho CRM | [Choose Waterfall Style](https://mobbin.com/screens/56e5fd35-4d92-481f-aaca-3b02adf911ae) | Genuine floating-bar waterfall chart with Increase/Decrease/Total legend, dashed connector lines, and an "Overall Difference" bracket |
| 17 | Monarch | [Cash Flow](https://mobbin.com/screens/c0152833-fd5f-4697-847f-d877f3855778) | Sankey-style cascade from income → categories, each node labeled with $ and % of total |
| 18 | Copilot Money | [Categories](https://mobbin.com/screens/7263637d-25a7-4b26-b1c5-58f5e11c379a) | Donut summary + per-category progress bar (green under budget, red over) |
| 19 | Rocket Money | [August 2025 Budget](https://mobbin.com/screens/5e4603b9-a7c5-4f15-8983-a1b37ca194c7) | Budgeted / Actual / Remaining 3-column table, color only on the Remaining figure |
| 20 | YNAB | [Plan](https://mobbin.com/screens/7b31b95f-4481-4fdd-b7e1-21c3f9bdf640) | Category-group budget table with a red "you assigned more than you have" banner and a "Fix This" CTA |
| 21 | Fey | [TSLA Earnings](https://mobbin.com/screens/57af7ece-6864-41ae-8b9e-94fa35074960) | Dark table with a colored "Beat/Missed" pill column, estimate-vs-actual pairs, right-aligned tabular numbers |
| 22 | Gusto | [Add Notification / role permissions form](https://mobbin.com/screens/e0a47820-67b2-46f7-9650-04a3d7e556b0) | Grouped radio-button sections (Time tracking, Scheduling, Expenses) each with sub-label copy; red banner "Please select some access you wish to give this role" pinned above Cancel/Continue |
| 23 | Cloudflare | [Add Notification](https://mobbin.com/screens/e8049d79-5b54-4b4d-906e-3484a3eebbf8) | Required-field form; red error banner "One or more required fields are missing or invalid" above the Save button |
| 24 | Sentry | [Alerts settings](https://mobbin.com/screens/7303ee16-6bfa-4578-a603-f9222dab19c6) | Numbered section headers ("3. Set margins", "4. Set thresholds") each a mini card with 2 fields |
| 25 | Xero | [Report Settings](https://mobbin.com/screens/54f947cd-27ec-47d8-a112-5f2c0b90be99) | 2-step header stepper, radio-group sections (Reporting basis, Filing period) |
| 26 | Origin | [Forecast](https://mobbin.com/screens/7c5d3bcb-74d4-40e2-a021-10d524562dc2) | 4-position slider (Frugally/Reasonably/Same as today/Lavishly) with a "Recommended" tag on one position, plus a numeric target-age field below |
| 27 | Claude | [Compound interest calculator artifact](https://mobbin.com/screens/025626bb-da23-4aaa-b892-83a399b2bc19) | 3 sliders driving a live-redrawn line chart and two headline result cards (Final balance, Interest earned) |
| 28 | Zillow | [Rent Affordability Calculator](https://mobbin.com/screens/3f26a087-7803-407c-b2b1-beb8052ecb49) | 4 input fields feed one live-computed result box with a slider + a plain-text disclaimer underneath |
| 29 | 7shifts | [Deep dive comparison of plans](https://mobbin.com/screens/0a9b21b2-170c-4eb4-b758-ead8060acd38) | 3-column feature table, current plan's column tinted and its column header called out in the brand color |
| 30 | Attio | [Compare all features](https://mobbin.com/screens/b833e2b5-82d5-4339-8dae-456ed5b5f4ad) | 4-column comparison, the recommended column fully outlined top-to-bottom in blue |
| 31 | Clockwise | [Smart calendar management comparison](https://mobbin.com/screens/6dfb7e0e-f5aa-43f5-a098-67de4cf6b776) | Long checkmark-grid comparison across 4 tiers, grouped under bold section subheads |
| 32 | ChatGPT | [Research chat with sources](https://mobbin.com/screens/73833b79-1dd5-4354-8fc4-a2e99c33a75e) | Numbered inline citation chips in the answer text; separate right-hand "Activity / X Sources" panel logging each source as it's read |
| 33 | Gemini Notebook | [Chat with numbered citations](https://mobbin.com/screens/05def46a-970f-46b2-8bf0-e0e83c7dd49e) | 3-pane layout (Sources checklist \| Chat \| Studio note), inline `[1][2]` markers in the answer |
| 34 | Cohere | [Playground — chat with tool use](https://mobbin.com/screens/4100675f-3440-45a6-8b20-de1a8c765568) | Collapsed "Performing multistep reasoning" trace shown above the answer, citation favicon chips below it |
| 35 | Notion | [Ask mode selector](https://mobbin.com/screens/0317bced-be59-439c-a6b9-9032b93835b4) | Dropdown directly above the chat input with "Ask mode" toggle plus separate Web access / My sources / Can make changes switches |
| 36 | Customer.io | [Journey AI agent chat](https://mobbin.com/screens/fafcbfb9-fa85-4b4d-b17f-54df962305b5) | "Thought for N seconds" collapsed reasoning row, hover-revealed "5 references" citation list with doc links |
| 37 | Sana AI | [Chat citing internal sources](https://mobbin.com/screens/67047d63-2ae6-44e0-a2a2-8d6989a14819) | Numbered source list in the answer body itself, each with a title, one-line description, and a "best primary source" label |
| 38 | Gorgias | [AI Agent test transcript](https://mobbin.com/screens/e077aad0-3aaa-4244-8c91-452d0f9e7b5f) | After closing an interaction, agent explicitly states "AI Agent used the following sources" with a linked list |
| 39 | Amplitude | [New metric — definition + preview](https://mobbin.com/screens/72da281c-87c1-45b6-a9ff-32b917844fbd) | Right-side form defining a metric (type, events) with a live preview chart and headline number below it |
| 40 | Whop | [Financial health & dispute risk](https://mobbin.com/screens/03413816-d3ca-4486-b76a-395028847517) | Popover: score gauge (0–5 colored bar) + "What impacts your score" breakdown, each factor showing its own rate/GMV numbers |
| 41 | Vercel | [Speed Insights explainer popover](https://mobbin.com/screens/bf38f98d-ffdd-4e02-801a-f420d60d244c) | Popover pairs a plain-language metric explanation with the live number and a "Learn more" link |
| 42 | Contra | [Discovery insights side sheet](https://mobbin.com/screens/fcb5d6ba-ee6a-477f-bf00-e3fcf317ab58) | Right-side sheet: score + "Why is this score important?" link + list of contributing factors, each expandable |
| 43 | Steep | [New metric preview](https://mobbin.com/screens/4285a7a9-7807-460a-b614-7ceba65f423d) | Definition form (table, aggregation, filter, format) next to a live "Preview metric" panel that fills once required fields are set |
| 44 | Coursera | [Module quiz results](https://mobbin.com/screens/56959b73-e28c-4ed8-a6f2-df91112e5a69) | Grade banner at top; each question shows the selected option with a green "Correct" band directly beneath it |
| 45 | Turo | [Test your knowledge](https://mobbin.com/screens/1055c068-8deb-4bc9-accc-33fae4e7aa32) | Selecting an answer reveals a green "Correct" band with a one-line explanation, progress bar at bottom |
| 46 | Brilliant | [Quiz — incorrect state](https://mobbin.com/screens/53d96faf-91a1-4af0-a917-53dc15960836) | Wrong answer shown with a yellow "Incorrect" band offering both "Try again" and "See answer" |
| 47 | Unity | [Quiz — wrong answer explained](https://mobbin.com/screens/66453a1e-26eb-4ba8-b27b-e907d1ecf92f) | Multi-select quiz; on incorrect submit, each wrong option gets its own explanatory bullet below the question |
| 48 | Uxcel | [Glossary](https://mobbin.com/screens/850c2bfa-b082-49f8-923c-6d26191f7684) | A–Z jump bar at top, term entries as cards (name, category, resource count, Follow button), search box coexists with the letter nav |
| 49 | Snowflake | [Data Dictionary](https://mobbin.com/screens/07bc5d27-649a-4250-9192-408950a56851) | Plain searchable table: term / type / one-line description — good minimal glossary-as-table pattern |
| 50 | WRITER | [Terms](https://mobbin.com/screens/5838922f-9dde-4bac-acce-ffcae680b8e5) | Term table with type, part of speech, description, and tag chips per row |
| 51 | Mintlify | [Analytics](https://mobbin.com/screens/205aefea-2dfc-4668-9af7-bc4921da1762) | Slim left icon-only sidebar (~8 items), top-left date-range dropdown with named presets + custom calendar |
| 52 | Midday | [Dashboard shell](https://mobbin.com/screens/d577de56-8df0-4645-b6c0-e02c089f59dd) | Icon sidebar + top-right period dropdown (3/6 months, This year, Custom, Fiscal year) opening a full calendar panel |
| 53 | Calendly | [Analytics](https://mobbin.com/screens/1d417c2e-234a-4bf0-a87e-dc65703c2b64) | Labeled left sidebar + date-range control that opens a 2-month calendar with explicit Cancel/Apply |
| 54 | Sweatpals | [Overview](https://mobbin.com/screens/23d13250-71ca-422c-a7e6-c35c4914c548) | Sidebar nav + period selector combining named presets (Month to date, Last 30 days) with a "Compare" toggle |
| 55 | Mixpanel | [Date range picker](https://mobbin.com/screens/ae6d8404-51d9-443a-81c0-c484d228f7d9) | Picker itself offers Fixed / Last / Since / Period-to-date tabs — a more advanced period-switcher pattern than a plain dropdown |

## Design recipe

### Layout & shell
- **D1.** Left icon+label sidebar for the app's ~8 sections (Import, Dashboard, Analysis, Planner, What-if, Copilot, Learn, Glossary); active item gets a filled pill or colored text, not just a border. *(Refs: 51, 52, 53, 54)*
- **D2.** Put the period/fiscal-year switcher in the top bar as a dropdown with named presets (e.g. "This period", "All periods", "Custom range") plus a calendar for custom, not a bare text input. *(Refs: 51, 52, 55)*
- **D3.** Keep the copilot chat as a persistent right-hand column with its own sub-panes (transcript + sources), not a modal overlay, so citations stay visible while the user works the page behind it. *(Refs: 32, 33)*
- **D4.** Keep global chrome neutral (no colorful top banner); save saturated color for status and deltas only. *(Refs: 11, 14)*

### Typography
- **D5.** Headline KPI numerals large and bold, with a small muted-gray label above — not below. *(Refs: 11, 14, 19)*
- **D6.** Right-align and use tabular figures in any table of amounts, so digits line up column-to-column. *(Refs: 6, 20, 21)*
- **D7.** Bold, small (section-label scale) headers above each grouped block of form fields. *(Refs: 22, 24)*

### Colour & surfaces
- **D8.** Green = favorable delta, red = unfavorable — applied identically to KPI-card deltas and variance-table arrows so the vocabulary doesn't shift between screens. *(Refs: 11, 12, 13, 19, 21)*
- **D9.** Light-gray page background, white cards with a thin 1px border, no heavy drop shadows. *(Refs: 14, 15)*
- **D10.** One saturated accent color reserved for primary CTAs and the active nav item; everything else neutral. *(Refs: 51, 53)*
- **D11.** Field-level error = red border + red text banner anchored near the section it blocks, not a floating toast. *(Refs: 22, 23, 9)*
- **D12.** Non-blocking warning = amber/yellow band, visually distinct from the red blocking-error state. *(Refs: 46, 7)*

### Data display (tables, charts, deltas)
- **D13.** KPI dashboard = grid of small-multiple cards: value, label, inline sparkline, and a colored %Δ vs. the prior period, three per row. *(Refs: 10, 11, 13, 14)*
- **D14.** Contribution-margin cascade = a genuine floating-bar waterfall with an Increase/Decrease/Total legend and dashed connector lines between bars, not a stacked bar chart pretending to be one. *(Ref: 16)*
- **D15.** Variance/analysis tables: metric name, current value, a direction arrow, the delta vs. comparison period, and an optional severity tag. *(Ref: 12)*
- **D16.** Budget-vs-actual = three columns (Budgeted / Actual / Remaining) with color applied only to the Remaining figure, not the whole row. *(Refs: 19, 20)*
- **D17.** Import review table: every cell inline-editable, error rows flagged with a red icon/border plus inline correction control, and a "show only rows with errors" toggle to triage large imports fast. *(Refs: 6, 7, 9)*
- **D18.** Insert an explicit column-mapping step between raw parsed import and the confirmed table, so a misread PDF field can be remapped before it's committed. *(Refs: 4, 8)*
- **D19.** Scenario comparison = a table with scenario names as columns and metrics as rows; highlight the differing or best value with a tinted/outlined column rather than color-coding every cell. *(Refs: 29, 30, 31)*

### Forms & validation
- **D20.** Break long decision-planner forms into named section cards (2–4 fields each) instead of one continuous scroll. *(Refs: 22, 24, 25)*
- **D21.** Pair a slider with a numeric input for each planning value (price, ad spend, R&D), with a live-recalculated result shown beside it, not on submit. *(Refs: 26, 27, 28)*
- **D22.** Mark a recommended/suggested position directly on the slider track itself. *(Ref: 26)*
- **D23.** Block submission with a banner naming the exact missing/invalid requirement, pinned just above the primary action button. *(Refs: 22, 23)*
- **D24.** For the import screen's three entry modes (drag-drop PDFs / paste text / manual entry), use tabs at the top of one shared panel rather than three separate screens. *(Refs: 4, 5)*

### AI chat & citations
- **D25.** Render citations as numbered inline markers in the answer text, each one opening or scrolling to its entry in a companion source list. *(Refs: 32, 33)*
- **D26.** Give the source list its own collapsible panel (title + link per source), separate from the running chat transcript. *(Refs: 32, 37)*
- **D27.** Put the Coach/Propose mode toggle as a labeled control directly above or beside the chat input box — not buried in a settings screen. *(Ref: 35)*
- **D28.** Show the copilot's reasoning as a small collapsed "Thought for Ns" / "Searching…" row above its answer, so Henri can audit what it checked before trusting the number. *(Refs: 34, 36)*
- **D29.** When the copilot proposes a decision or closes out a check, explicitly list which report/lecture-note sources it used underneath the message. *(Ref: 38)*

### Learning surfaces
- **D30.** "Explain this number" = an info icon opening a right-side panel with: one-line definition, the formula, and the actual period's numbers substituted into it, plus a live-preview style rendering. *(Refs: 39, 41, 43)*
- **D31.** Metric/score explainer panels include a "why this matters" link and break the total into its contributing factors, each shown with its own sub-value. *(Refs: 40, 42)*
- **D32.** Glossary = A–Z jump bar at the top, entries as rows/cards with a one-line description, search box coexisting with (not replacing) the letter browse. *(Refs: 48, 49, 50)*
- **D33.** Post-period quiz: reveal correct/incorrect immediately per question with a colored inline band (green/red) and a one-line explanation of why. *(Refs: 44, 45, 47)*
- **D34.** On an incorrect quiz answer, offer "Try again" alongside "See answer" instead of forcing an immediate reveal. *(Ref: 46)*

### Motion & states
- **D35.** Error and warning states communicate through color + explicit text together, never color or an icon alone. *(Refs: 22, 23)*
- **D36.** A "show only rows with errors" filter toggle lets Henri triage a big multi-report import without scrolling the full table. *(Refs: 7, 9)*

## Per-screen notes

**1. Import** — Drag-drop zone with a secondary "or click/upload" affordance and multi-file support (1, 2, 3). Add "Upload file" / "Paste text" tabs at the top of the same panel rather than a separate screen per method (4, 5). After parsing, land on a review table with every value inline-editable, errors flagged in red with a filter toggle, and a column-mapping step if a field was misread (6, 7, 8, 9).

**2. KPI dashboard** — Grid of small-multiple cards: bold value, muted label, inline sparkline, colored %Δ vs. prior period, 3 per row (10, 13, 14). Widen to a table view (variance table: metric / value / arrow / delta / tag) when Henri wants more than 6 KPIs on screen at once (12).

**3. Analysis** — Contribution-margin cascade should be a real waterfall chart (floating bars, Increase/Decrease/Total legend, dashed connectors) — not a stacked bar (16). Cash-flow style breakdowns can instead use a Sankey-like cascade when showing where money went rather than how a number was built up (17). Budget/spend breakdown tables pair a value with a progress bar or a colored Remaining column (18, 19).

**4. Decision planner** — Group the long form into named section cards (Pricing, Advertising, R&D, Production, Hiring, Loans), 2–4 fields per card (20, 24, 25). Each numeric decision pairs a slider with a numeric input and shows the live-recalculated consequence beside it (cash position, capacity used) (21, 26, 27, 28). Block submit with a banner naming the exact missing/invalid field, not a generic "fix errors" message (23, 22).

**5. What-if** — Render scenarios as columns in a single comparison table, metrics as rows, with the differing or better value tinted/outlined per column (29, 30, 31). Keep a persistent "current plan"-style label on whichever scenario is active, matching the highlighted-column pattern these references use for the user's selected tier.

**6. AI copilot chat** — Persistent right-column layout: transcript, then inline numbered citations, then a separate collapsible sources panel (32, 33). Put the Coach/Propose mode switch directly above the input box (35). Show a brief "Thought for Ns" / "Searching reports…" trace before the answer so Henri can see what it checked (34, 36), and explicitly list sources used when it closes out a suggestion (38).

**7. Learning ("explain this number", quiz, glossary)** — Info icon → right-side panel: definition, formula, real numbers substituted in, live-style preview (39, 41, 43). For KPI/score explainers, break the total into contributing factors with their own values and a "why this matters" link (40, 42). Quiz: immediate colored correct/incorrect band with a one-line why, "Try again" offered before revealing the answer (44, 45, 46, 47). Glossary: A–Z jump bar + search box + one-line-description rows (48, 49, 50).

**8. App shell / navigation** — Left icon+label sidebar for the ~8 sections; top-right period switcher as a dropdown with named presets plus a full calendar for custom ranges (51, 52, 53). For finer period control (comparing two custom periods), a tabbed Fixed/Last/Since picker outperforms a single dropdown (55, 54).

## Decisions (Henri, 2026-09-29)

- C1 Navigation: left sidebar (D1).
- C2 Theme: light (D9).
- C3 Copilot: collapsible right-hand panel, docked on every screen (D3).
- C4 Contribution margin chart: waterfall (D14); no Sankey in v1.
- C5 Quiz: Try again first, then See answer (D34).

## Open choices for Henri (resolved above)

1. **Sidebar vs. top nav** — every researched reference for an ~8-section dashboard app uses a left icon sidebar (51–54), none use a pure top nav at this density. Confirm sidebar is the right call before building it any other way.
2. **Light vs. dark default** — nearly all finance/study references researched are light (Xero, Midday, Whop, Amplitude, Coursera); only the AI-assistant references (ChatGPT, Claude) commonly ship a dark mode. Should the whole app default light to match the finance-app tone, or should the copilot's own chat pane specifically support/default to dark?
3. **Copilot as a docked panel vs. a dedicated screen** — Gemini Notebook (33) keeps a 3-pane docked layout with chat always visible beside content; ChatGPT (32) treats the chat as the entire page. Does the copilot travel with every screen, or get its own tab in the sidebar?
4. **Waterfall vs. cascade/Sankey style** — Zoho CRM's waterfall (16) suits "how contribution margin I becomes V"; Monarch's Sankey (17) suits "where did the money go." Pick one as the default contribution-margin visual, or use both depending on the question being asked.
5. **Quiz correction style** — Coursera/Turo (44, 45) reveal correct/incorrect immediately with the explanation; Brilliant (46) offers a retry before revealing. Which fits the post-period quiz's learning goal better — immediate feedback, or a forced retry first?

## Redesign research (2026-10-01, via `scripts/mobbin.sh`, the claude CLI + Mobbin connector)

Goal (Henri): clearer, better organised, graspable at a glance, not overwhelming. Every screen below was returned by Mobbin; the full lists are in `docs/mobbin/*.json` (layout + take per screen). Rules R1-R6 extend D1-D36.

- **R1 One hero per page.** Dashboard: one hero number, the alert strip directly under it, secondary cards demoted to equal weight (Deel, Quicken, Copilot Money: `docs/mobbin/dashboard.json`).
- **R2 Group the sidebar, not the page.** Labelled groups (Plan / Learn / Data) instead of eight flat items; the assistant is a quiet docked panel (Google Ads, Klaviyo, Quicken, Fibery: `shell.json`). *Built in redesign step 1.*
- **R3 Tabs instead of stacked cards.** Headline KPI row first, then tabs switch the topic below it (Vercel, Mintlify, Calendly, Squarespace: `analysis.json`).
- **R4 Results above the controls.** Planner keeps the outcome numbers in view while sliders/fields change; inputs grouped under short section headers with reset (Claude calculator, Quicken, Churnkey, Origin: `planner.json`).
- **R5 One question, one path.** Quiz: question large, options as plain rows, feedback by recolouring the row, chrome at the edges (Duolingo, The Leap); glossary: one A-Z bar, text-only rows (Uxcel, Selfridges: `learn.json`).
- **R6 Shrink what is finished.** Import: near-empty canvas with one drop zone and a thin stepper; once data exists it becomes a slim status (Resend, Remote, Calendly, Workable: `import.json`).

Redesign steps: 1 shell (R2, C3) done; 2 dashboard (R1); 3 analysis (R3); 4 planner + what-if (R4); 5 quiz, glossary, import (R5, R6); 6 shared polish.
