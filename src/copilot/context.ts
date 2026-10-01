import type { PeriodFile } from "../store/periodStore";

export type CopilotMode = "coach" | "propose";

export interface LectureNote {
  name: string;
  text: string;
}

export interface PromptInput {
  mode: CopilotMode;
  handbook: string;
  lecture: LectureNote[];
  periods: PeriodFile[];
}

const COMMON = `You are the copilot inside Henri's TOPSIM Copilot app. Henri plays TOPSIM – Management Essentials
(company mosaic GmbH, printed by TOPSIM as "Company 2"; product: the SuperBass headphone; one period = one
fiscal year) for the course "Managerial Accounting and Controlling". He is a business student; he types the final
decisions into TOPSIM himself — you never log in to anything.

Rules for every answer:
- Ground every number and rule in the SOURCES below. Cite each one in square brackets exactly as its label is
  written, e.g. [Period 0 · TNB11 · Profit and Loss Statement] or [Handbook] or [Lecture: Class Notes.md].
- If the sources do not contain what is needed, say so plainly. Never invent a number, a rule or a citation.
- Explain the controlling concept behind each number you use (what it is, the formula, why it moved) —
  Henri wants to understand the material, not only get an answer.
- Plain prose, short, English. Numbers as TOPSIM prints them (TEUR where the report says TEUR).`;

const MODES: Record<CopilotMode, string> = {
  coach: `MODE: COACH. Teach and ask. Explain the concept, point to the relevant numbers, then ask Henri a guiding
question or name the trade-off he must weigh. Do not hand over a finished decision — help him reach his own,
and check his reasoning when he gives it.`,
  propose: `MODE: PROPOSE. Henri wants a recommendation. Give a full decision set (price, advertising, R&D/quality,
production, staff, loans, dividends — every area that matters now) with the reasoning for each, and close with the
sources you used. Mark every guess as a guess. Henri still decides and enters it himself.`,
};

/** Corrected numbers, so the copilot reasons about what Henri fixed, not the misread. */
function reportText(raw: string, corrections: { from: number | string; to: string }[] | undefined): string {
  if (!corrections?.length) return raw;
  const notes = corrections.map((c) => `Henri corrected the printed value ${c.from} to ${c.to}.`);
  return `${raw}\n(${notes.join(" ")})`;
}

/** Every source the copilot may cite, as [label, text] — one place decides the labels. */
function sources({ handbook, lecture, periods }: Pick<PromptInput, "handbook" | "lecture" | "periods">): [string, string][] {
  const out: [string, string][] = [["Handbook", handbook.trim()]];
  for (const note of lecture) out.push([`Lecture: ${note.name}`, note.text.trim()]);
  for (const p of periods) {
    for (const [code, r] of Object.entries(p.reports)) {
      // The raw text is what TOPSIM printed; a fix of Henri's is appended so the copilot knows the real value.
      out.push([`Period ${p.period} · ${code} · ${r.parsed.title}`, reportText(r.raw, r.corrections)]);
    }
  }
  return out;
}

export function sourceLabels(input: Pick<PromptInput, "handbook" | "lecture" | "periods">): string[] {
  return sources(input).map(([label]) => label);
}

/** Everything the copilot may use, each block under a label it can cite (PRD Must 6). */
export function buildSystemPrompt({ mode, handbook, lecture, periods }: PromptInput): string {
  const blocks = sources({ handbook, lecture, periods }).map(([label, text]) => `[${label}]\n${text}`);
  return `${COMMON}\n\n${MODES[mode]}\n\n=== SOURCES ===\n\n${blocks.join("\n\n")}`;
}
