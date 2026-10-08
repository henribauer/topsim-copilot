// Inspects the real build output: asar listing, .app tree, signature, architecture, and the mounted DMG.
// Run: ARCH=arm64 npx vite-node scripts/inspect-package.ts   (exit 1 on any violation)
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync, lstatSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import asar from "@electron/asar";
import { checkAsarEntries, checkResources, checkTree } from "../src/desktop/allowlist";

const ARCH = process.env.ARCH ?? "arm64";
const release = join(process.env.TOPSIM_LOCAL ?? join(homedir(), "claude-local", "topsim-copilot"), "release");
const app = join(release, ARCH === "arm64" ? "mac-arm64" : "mac", "TOPSIM Copilot.app");
const { version } = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
const dmg = join(release, `TOPSIM-Copilot-${version}-${ARCH}.dmg`);
const scratch = join(homedir(), ".hermes", "cache", "scratch", "topsim-mac-e2e");
mkdirSync(scratch, { recursive: true });
const run = (cmd: string, args: string[]) => {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  return `${r.stdout ?? ""}${r.stderr ?? ""}`;
};
const walk = (dir: string, base = ""): string[] =>
  readdirSync(dir).flatMap((n) => {
    const rel = base ? `${base}/${n}` : n;
    return lstatSync(join(dir, n)).isDirectory() ? walk(join(dir, n), rel) : [rel];
  });

const entries = asar.listPackage(join(app, "Contents", "Resources", "app.asar"));
const tree = walk(app);
const report = {
  arch: ARCH,
  asarEntries: entries,
  asarViolations: checkAsarEntries(entries),
  resourcesTopLevel: readdirSync(join(app, "Contents", "Resources")),
  resourcesViolations: checkResources(readdirSync(join(app, "Contents", "Resources"))),
  treeFileCount: tree.length,
  treeViolations: checkTree(tree),
  codesignVerify: run("codesign", ["--verify", "--deep", "--strict", "-vv", app]).trim(),
  codesignInfo: run("codesign", ["-dv", app]).split("\n").filter((l) => /Identifier|Signature|flags|Authority|TeamIdentifier|Format/.test(l)),
  lipo: run("lipo", ["-archs", join(app, "Contents", "MacOS", "TOPSIM Copilot")]).trim(),
  spctl: run("spctl", ["-a", "-vv", "-t", "exec", app]).trim(),
  infoPlist: Object.fromEntries(["CFBundleIdentifier", "CFBundleName", "CFBundleShortVersionString", "LSMinimumSystemVersion"].map((k) => [k, run("/usr/libexec/PlistBuddy", ["-c", `Print :${k}`, join(app, "Contents", "Info.plist")]).trim()])),
  dmg: { path: dmg, bytes: lstatSync(dmg).size, sha256: run("shasum", ["-a", "256", dmg]).split(" ")[0], contents: [] as string[], appInsideVerifies: "" },
};
const mnt = join(scratch, `mnt-${ARCH}`);
mkdirSync(mnt, { recursive: true });
run("hdiutil", ["attach", "-nobrowse", "-readonly", "-noverify", "-mountpoint", mnt, dmg]);
try {
  report.dmg.contents = readdirSync(mnt).sort();
  report.dmg.appInsideVerifies = run("codesign", ["--verify", "--deep", "--strict", join(mnt, "TOPSIM Copilot.app")]).trim() || "valid";
} finally {
  run("hdiutil", ["detach", mnt]);
}
const out = join(scratch, `inspect-${ARCH}.json`);
writeFileSync(out, JSON.stringify(report, null, 2));
const { asarEntries, ...short } = report;
console.log(JSON.stringify({ ...short, asarEntryCount: asarEntries.length }, null, 2), `\nfull report: ${out}`);
const bad = report.asarViolations.length + report.resourcesViolations.length + report.treeViolations.length;
if (bad > 0 || report.dmg.contents.indexOf("TOPSIM Copilot.app") < 0) process.exit(1);
