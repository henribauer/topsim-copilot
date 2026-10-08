import { describe, expect, it } from "vitest";
import { checkAsarEntries, checkResources, checkTree } from "../src/desktop/allowlist";

const GOOD = ["/package.json", "/main.cjs", "/preload.cjs", "/dist", "/dist/index.html", "/dist/favicon.svg", "/dist/assets", "/dist/assets/index-abc.js", "/dist/assets/index-abc.css", "/dist/assets/pdf.worker.min-xyz.mjs"];

describe("checkAsarEntries — only the staged runtime files may be inside app.asar", () => {
  it("accepts the page, its assets, the bundled main/preload and package.json", () => {
    expect(checkAsarEntries(GOOD)).toEqual([]);
  });
  it("flags source documents, fixtures, dependencies, source maps and anything else not on the list", () => {
    const bad = ["/dist/handbook.txt", "/docs/p0_reports_sample.txt", "/node_modules/x/index.js", "/dist/assets/index.js.map", "/dist/fixtures", "/dist/a.zip", "/dist/Report11.pdf", "/.env", "/main.cjs.bak", "/dist/mobbin/ref.png", "/tests"];
    const found = checkAsarEntries([...GOOD, ...bad]);
    expect(found.sort()).toEqual([...bad].sort());
  });
});

describe("checkResources — the app's Resources folder holds the archive, the icon and locale folders only", () => {
  it("accepts the expected entries and flags an unpacked folder or any stray file", () => {
    expect(checkResources(["app.asar", "icon.icns", "en.lproj", "en_US.lproj"])).toEqual([]);
    expect(checkResources(["app.asar", "app.asar.unpacked", "docs", "notes.txt"]).sort()).toEqual(["app.asar.unpacked", "docs", "notes.txt"]);
  });
});

describe("checkTree — names that must not appear anywhere in the .app", () => {
  it("flags handbook, report samples, Mobbin dumps, zips/PDFs and credentials by name, anywhere", () => {
    const tree = ["Contents/MacOS/TOPSIM Copilot", "Contents/Resources/app.asar", "Contents/Frameworks/Electron Framework.framework/Resources/icudtl.dat", "Contents/Resources/handbook.txt", "x/p0_reports_sample.txt", "y/Mobbin/a.png", "z/reports.zip", "z/Report.pdf", "z/credentials.json"];
    expect(checkTree(tree)).toEqual(["Contents/Resources/handbook.txt", "x/p0_reports_sample.txt", "y/Mobbin/a.png", "z/reports.zip", "z/Report.pdf", "z/credentials.json"]);
  });
});
