import { join, posix, sep } from "node:path";

/** The desktop app serves its page and its API from this scheme and nothing else (no network port is opened). */
export const APP_HOST = "topsim";
export const APP_URL = `app://${APP_HOST}/`;

export function isAppUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "app:" && u.hostname === APP_HOST;
  } catch {
    return false;
  }
}

/** Official pages the setup screen links to; a link opens in the browser only if it passes this check. */
const EXTERNAL: { host: string; path: string }[] = [
  { host: "code.claude.com", path: "/docs/" },
  { host: "claude.com", path: "/pricing" },
];

export function externalLinkAllowed(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || u.username || u.password || u.port) return false;
    return EXTERNAL.some((e) => u.hostname === e.host && u.pathname.startsWith(e.path));
  } catch {
    return false;
  }
}

/**
 * The file under `root` for a request path, or null if the path is not a plain path inside it (traversal,
 * backslashes, NUL bytes, bad escapes). "/" is the app's page.
 */
export function resolveStaticPath(root: string, urlPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes("\0") || decoded.includes("\\")) return null;
  // No ".." segment at all: posix.normalize would quietly clamp "/../x" to "/x" instead of refusing it.
  if (decoded.split("/").includes("..")) return null;
  const rel = posix.normalize(`/${decoded}`);
  const full = join(root, rel === "/" ? "index.html" : rel);
  return full === root || full.startsWith(root + sep) ? full : null;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
};

export function mimeFor(file: string): string {
  const ext = /\.[a-z0-9]+$/i.exec(file)?.[0].toLowerCase() ?? "";
  return MIME[ext] ?? "application/octet-stream";
}

/** Page rules: own files only. 'unsafe-inline' for styles is React's style="…" attributes; there is no inline script. */
export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");
