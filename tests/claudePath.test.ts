import { describe, expect, it } from "vitest";
import { claudeEnv, findClaude } from "../src/copilot/claudePath";

const HOME = "/Users/henri";

describe("findClaude", () => {
  it("uses the first install location that exists, so the app works when started from the desktop icon (minimal PATH)", () => {
    const exists = (p: string) => p === `${HOME}/.local/bin/claude`;
    expect(findClaude({ home: HOME, env: {}, exists })).toBe(`${HOME}/.local/bin/claude`);
  });

  it("prefers an explicit TOPSIM_CLAUDE over everything else", () => {
    const exists = () => true;
    expect(findClaude({ home: HOME, env: { TOPSIM_CLAUDE: "/opt/x/claude" }, exists })).toBe("/opt/x/claude");
  });

  it("ignores TOPSIM_CLAUDE when that file is not there", () => {
    const exists = (p: string) => p === "/opt/homebrew/bin/claude";
    expect(findClaude({ home: HOME, env: { TOPSIM_CLAUDE: "/gone/claude" }, exists })).toBe("/opt/homebrew/bin/claude");
  });

  it("falls back to plain 'claude' (found via PATH) when no known location has it", () => {
    expect(findClaude({ home: HOME, env: {}, exists: () => false })).toBe("claude");
  });
});

describe("claudeEnv", () => {
  it("adds USER and LOGNAME when the app was started without them — claude reads its login from the keychain by user name", () => {
    const env = claudeEnv({ PATH: "/usr/bin:/bin", HOME: "/Users/henri" }, "henri");
    expect(env.USER).toBe("henri");
    expect(env.LOGNAME).toBe("henri");
  });

  it("keeps the values it was given, and everything else unchanged", () => {
    const env = claudeEnv({ USER: "x", LOGNAME: "y", PATH: "/p", FOO: "1" }, "henri");
    expect(env).toEqual({ USER: "x", LOGNAME: "y", PATH: "/p", FOO: "1" });
  });
});

import { findClaudeBinary } from "../src/copilot/claudePath";

describe("findClaudeBinary — null instead of a guess, so setup can say 'not installed'", () => {
  it("finds the native install and the Homebrew install although Finder's PATH has neither", () => {
    expect(findClaudeBinary({ home: HOME, env: { PATH: "/usr/bin:/bin" }, exists: (p) => p === `${HOME}/.local/bin/claude` })).toBe(`${HOME}/.local/bin/claude`);
    expect(findClaudeBinary({ home: HOME, env: { PATH: "/usr/bin:/bin" }, exists: (p) => p === "/opt/homebrew/bin/claude" })).toBe("/opt/homebrew/bin/claude");
  });

  it("also looks through PATH, and returns null when claude is nowhere", () => {
    expect(findClaudeBinary({ home: HOME, env: { PATH: "/usr/bin:/custom/bin" }, exists: (p) => p === "/custom/bin/claude" })).toBe("/custom/bin/claude");
    expect(findClaudeBinary({ home: HOME, env: { PATH: "/usr/bin" }, exists: () => false })).toBeNull();
  });
});
