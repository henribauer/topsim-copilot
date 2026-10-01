/**
 * The three-step rail of the import page (redesign step 5, R6; Mobbin: Resend, Remote, Calendly, Workable in
 * docs/mobbin/import.json): add files, check them, save. It only says where Henri is; the page shows one action per step.
 */
export type ImportProgress = { status: "idle" } | { status: "reading" } | { status: "ready"; readable: number; saved: number };

export interface Steps {
  /** 1-based. */
  current: 1 | 2 | 3;
  labels: ["Add files", "Check", "Save"];
  done: boolean;
}

const LABELS: Steps["labels"] = ["Add files", "Check", "Save"];

export function importSteps(p: ImportProgress): Steps {
  if (p.status !== "ready") return { current: 1, labels: LABELS, done: false };
  // With nothing readable there is nothing to save, so the page stays on "Check" to show why.
  const allSaved = p.readable > 0 && p.saved >= p.readable;
  return { current: allSaved ? 3 : 2, labels: LABELS, done: allSaved };
}
