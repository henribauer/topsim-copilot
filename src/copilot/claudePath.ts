import { existsSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import { join } from "node:path";

interface Where {
  home: string;
  env: Record<string, string | undefined>;
  exists: (path: string) => boolean;
}

/**
 * Where the `claude` command lives, or null when it is nowhere. The app is started from the desktop icon, and apps
 * started from Finder get a minimal PATH (/usr/bin:/bin:...) that does not contain ~/.local/bin — so asking the shell
 * for "claude" fails there even though it works in a terminal. We look in the usual install places first (native
 * installer, Homebrew), then through PATH.
 */
export function findClaudeBinary(
  where: Where = { home: homedir(), env: process.env, exists: existsSync },
): string | null {
  const { home, env, exists } = where;
  const candidates = [
    env.TOPSIM_CLAUDE,
    join(home, ".local", "bin", "claude"),
    "/opt/homebrew/bin/claude",
    "/usr/local/bin/claude",
    join(home, ".claude", "local", "claude"),
    ...(env.PATH ?? "").split(":").filter(Boolean).map((dir) => join(dir, "claude")),
  ];
  for (const c of candidates) if (c && exists(c)) return c;
  return null;
}

/** The command to run: the file found above, or plain "claude" (resolved through PATH by the OS) when none was found. */
export function findClaude(where?: Where): string {
  return findClaudeBinary(where) ?? "claude";
}

/**
 * The environment `claude` runs in. A Finder-started app has no USER/LOGNAME, and without them claude cannot
 * find its login in the macOS keychain: it answers "Not logged in" although Henri is logged in.
 */
export function claudeEnv(
  env: Record<string, string | undefined> = process.env,
  user: string = userInfo().username,
): Record<string, string | undefined> {
  return { ...env, USER: env.USER ?? user, LOGNAME: env.LOGNAME ?? user };
}
