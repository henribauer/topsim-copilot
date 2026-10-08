// Stages the desktop app: the production renderer (dist/) plus the bundled main/preload, into a folder that
// contains nothing else. electron-builder packs that folder, so what ships is exactly what this script copies —
// a strict allowlist, not "everything except". Output lives outside iCloud (~/claude-local/topsim-copilot/stage).
import { build } from "esbuild";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const local = process.env.TOPSIM_LOCAL ?? join(homedir(), "claude-local", "topsim-copilot");
const stage = join(local, "stage");
const ALLOWED_RENDERER = new Set([".html", ".js", ".mjs", ".css", ".svg", ".png", ".ico", ".wasm", ".woff2"]);

if (!existsSync(join(root, "dist", "index.html"))) throw new Error("dist/index.html is missing — run `npm run build` first.");
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

for (const [entry, out] of [["src/desktop/main.ts", "main.cjs"], ["src/desktop/preload.ts", "preload.cjs"]]) {
  await build({
    entryPoints: [join(root, entry)],
    outfile: join(stage, out),
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    external: ["electron"],
    legalComments: "none",
    logLevel: "warning",
  });
}

const dist = realpathSync(join(root, "dist"));
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
for (const file of walk(dist)) {
  if (!ALLOWED_RENDERER.has(extname(file))) throw new Error(`Unexpected file in dist/ (extension not on the allowlist): ${file.slice(dist.length + 1)}`);
}
cpSync(dist, join(stage, "dist"), { recursive: true, dereference: true });

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
writeFileSync(
  join(stage, "package.json"),
  JSON.stringify(
    {
      name: "topsim-copilot",
      productName: "TOPSIM Copilot",
      version: pkg.version,
      description: "A learning companion for the TOPSIM management simulation",
      author: "Henri Bauer",
      main: "main.cjs",
      private: true,
    },
    null,
    2,
  ) + "\n",
);
const size = walk(stage).reduce((n, f) => n + statSync(f).size, 0);
console.log(`staged ${walk(stage).length} files, ${(size / 1024 / 1024).toFixed(1)} MB → ${stage}`);
