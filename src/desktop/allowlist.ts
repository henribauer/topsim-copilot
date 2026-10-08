/**
 * The shipped app is a strict allowlist, checked against the real package (scripts/inspect-package.ts):
 * inside app.asar only the staged runtime files, in Resources only the archive, icon and locale folders, and no
 * file anywhere named like a source document, fixture, dump or credential.
 */
const ASAR_FILES = new Set(["/package.json", "/main.cjs", "/preload.cjs"]);
const RENDERER_EXT = /\.(html|js|mjs|css|svg|png|ico|wasm|woff2)$/;
const FORBIDDEN = [/handbook/i, /p0_reports/i, /mobbin/i, /fixture/i, /\.(zip|pdf|pem|p12)$/i, /(^|\/)\.env/i, /credentials?\b|id_rsa/i];

export function checkTree(files: string[]): string[] {
  return files.filter((f) => FORBIDDEN.some((re) => re.test(f)));
}

/** Entries as `asar list` prints them ("/dist", "/dist/index.html", …); directories have no extension. */
export function checkAsarEntries(entries: string[]): string[] {
  return entries.filter((e) => {
    if (checkTree([e]).length > 0) return true;
    if (ASAR_FILES.has(e) || e === "/dist") return false;
    if (!e.startsWith("/dist/")) return true;
    const last = e.slice(e.lastIndexOf("/") + 1);
    return last.includes(".") && !RENDERER_EXT.test(e);
  });
}

export function checkResources(names: string[]): string[] {
  return names.filter((n) => !/^(app\.asar|icon\.icns|[A-Za-z_]+\.lproj)$/.test(n));
}
