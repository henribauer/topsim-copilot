// Packs the staged folder (scripts/build-desktop.mjs) into a macOS .app and .dmg. Output goes outside iCloud.
const os = require("node:os");
const path = require("node:path");
const local = process.env.TOPSIM_LOCAL || path.join(os.homedir(), "claude-local", "topsim-copilot");

module.exports = {
  appId: "app.topsimcopilot.mac",
  productName: "TOPSIM Copilot",
  electronVersion: "44.7.0",
  directories: { app: path.join(local, "stage"), output: path.join(local, "release"), buildResources: path.join(__dirname, "..", "assets") },
  // The stage folder holds nothing else, and this list repeats that: a file not named here cannot ship.
  // "!**/node_modules/**": electron-builder otherwise climbs to the project's package.json and packs its dependencies.
  files: ["package.json", "main.cjs", "preload.cjs", "dist/**/*", "!**/node_modules/**"],
  // No updater and no feed: nothing is published and the app never phones home for updates (no app-update.yml).
  publish: null,
  asar: true,
  npmRebuild: false,
  artifactName: "TOPSIM-Copilot-${version}-${arch}.${ext}",
  electronLanguages: ["en", "en_US"],
  afterPack: path.join(__dirname, "adhoc-sign.cjs"),
  mac: {
    target: [{ target: "dmg" }],
    category: "public.app-category.education",
    icon: path.join(__dirname, "..", "assets", "icon.icns"),
    // No Developer ID certificate here: electron-builder skips signing (afterPack ad-hoc signs), no notarization.
    identity: null,
    hardenedRuntime: false,
    gatekeeperAssess: false,
    notarize: false,
  },
  dmg: {
    title: "TOPSIM Copilot",
    contents: [
      { x: 130, y: 200, type: "file" },
      { x: 410, y: 200, type: "link", path: "/Applications" },
    ],
    window: { width: 540, height: 380 },
    writeUpdateInfo: false,
  },
};
