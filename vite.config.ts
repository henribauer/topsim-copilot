/// <reference types="vitest/config" />
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { handleApi, readBody } from "./src/server/api";

/** Where imported reports go (PRD: data lives in the vault). TOPSIM_VAULT overrides it, e.g. for a test run. */
const VAULT_DIR = process.env.TOPSIM_VAULT ?? join(homedir(), "claude", "Cowork OS", "TOPSIM");

/** The lecture folder for this course (PRD: read-only), and the handbook that ships in the repo. */
const COURSE_DIR =
  process.env.TOPSIM_COURSE ??
  join(homedir(), "claude", "Cowork OS", "University", "Universität", "3rd Semester", "Managerial Accounting and Controlling");
const HANDBOOK = fileURLToPath(new URL("./docs/handbook.txt", import.meta.url));

/** Mounts every /api route on the local dev server; the logic is the shared router in src/server/api.ts. */
function saveApi(): Plugin {
  const ctx = {
    vaultDir: VAULT_DIR,
    copilot: () => ({ vaultDir: VAULT_DIR, courseDir: COURSE_DIR, handbookPath: HANDBOOK }),
  };
  return {
    name: "topsim-save-api",
    configureServer(server) {
      server.middlewares.use("/api", async (req, res) => {
        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(body));
        };
        const method = req.method ?? "GET";
        const body = method === "GET" || method === "HEAD" ? "" : await readBody(req);
        if (body === null) return send(413, { ok: false, error: "Request body too large" });
        const path = new URL(req.originalUrl ?? req.url ?? "/", "http://localhost").pathname;
        const out = await handleApi(ctx, { method, path, body, origin: req.headers.origin });
        send(out.status, out.body);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), saveApi()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
