import { describe, expect, it } from "vitest";
import { externalLinkAllowed } from "../src/desktop/security";
import { INSTALL_COMMAND, INSTALL_DOCS_URL, LOGIN_COMMAND, PLANS_URL } from "../src/setup/commands";
import { setupView, sourcesPhrase } from "../src/setup/view";
import type { ClaudeStatus } from "../src/setup/claudeStatus";

const status = (state: ClaudeStatus["state"]): ClaudeStatus => ({ state, installed: null, signedIn: null, version: null, message: "m" });

describe("the commands the setup screen offers", () => {
  it("are exactly Anthropic's documented macOS install line and the CLI's own sign-in command", () => {
    expect(INSTALL_COMMAND).toBe("curl -fsSL https://claude.ai/install.sh | bash");
    expect(LOGIN_COMMAND).toBe("claude auth login");
  });
  it("link only to pages the app is willing to open", () => {
    expect(externalLinkAllowed(INSTALL_DOCS_URL)).toBe(true);
    expect(externalLinkAllowed(PLANS_URL)).toBe(true);
  });
});

describe("setupView — what the screen shows for each Claude state", () => {
  it("asks for install and sign-in when Claude is missing, only sign-in when installed but logged out", () => {
    expect(setupView(status("missing"))).toMatchObject({ tone: "todo", steps: ["install", "login"], primary: "Skip for now" });
    expect(setupView(status("installed-logged-out"))).toMatchObject({ tone: "todo", steps: ["login"], primary: "Skip for now" });
  });
  it("shows nothing to do when ready, and offers 'Done' instead of 'Skip'", () => {
    expect(setupView(status("ready"))).toMatchObject({ tone: "ok", steps: [], primary: "Done" });
  });
  it("shows both instructions for reference when the check itself failed, and a neutral state while checking", () => {
    expect(setupView(status("check-failed"))).toMatchObject({ tone: "warn", steps: ["install", "login"] });
    expect(setupView(null)).toMatchObject({ tone: "checking", steps: [], primary: "Skip for now" });
  });
});

describe("sourcesPhrase — the copilot never claims a source the user has not added", () => {
  it("names exactly the sources present", () => {
    expect(sourcesPhrase(true, true)).toBe("the TOPSIM handbook, your lecture notes and every report you imported");
    expect(sourcesPhrase(false, true)).toBe("your lecture notes and every report you imported");
    expect(sourcesPhrase(true, false)).toBe("the TOPSIM handbook and every report you imported");
    expect(sourcesPhrase(false, false)).toBe("every report you imported");
  });
});
