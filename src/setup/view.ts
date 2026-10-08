import type { ClaudeStatus } from "./claudeStatus";

export type SetupStep = "install" | "login";
export interface SetupView {
  headline: string;
  tone: "checking" | "ok" | "todo" | "warn";
  steps: SetupStep[];
  /** One button closes the screen; it says "Done" only when there is nothing left to do. */
  primary: "Done" | "Skip for now";
}

export function setupView(status: ClaudeStatus | null): SetupView {
  if (!status) return { headline: "Checking Claude…", tone: "checking", steps: [], primary: "Skip for now" };
  switch (status.state) {
    case "ready":
      return { headline: "Claude is ready", tone: "ok", steps: [], primary: "Done" };
    case "installed-logged-out":
      return { headline: "Claude is installed — sign in to finish", tone: "todo", steps: ["login"], primary: "Skip for now" };
    case "missing":
      return { headline: "Claude is not installed", tone: "todo", steps: ["install", "login"], primary: "Skip for now" };
    case "check-failed":
      return { headline: "Claude could not be checked", tone: "warn", steps: ["install", "login"], primary: "Skip for now" };
  }
}

/** What the copilot's answers are based on, for the empty state: only sources that really exist. */
export function sourcesPhrase(handbook: boolean, lecture: boolean): string {
  const parts = [handbook && "the TOPSIM handbook", lecture && "your lecture notes"].filter(Boolean) as string[];
  const reports = "every report you imported";
  return parts.length === 0 ? reports : `${parts.join(", ")} and ${reports}`.replace(/^(.*), (.*) and (every.*)$/, "$1, $2 and $3");
}
