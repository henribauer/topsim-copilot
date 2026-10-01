/// <reference types="vitest/config" />
import { homedir } from "node:os";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { handleCorrectionDelete, handleCorrectionRequest, handlePeriodsRequest, handleSaveRequest } from "./src/store/saveApi";

/** Where imported reports go (PRD: data lives in the vault). TOPSIM_VAULT overrides it, e.g. for a test run. */
const VAULT_DIR = process.env.TOPSIM_VAULT ?? join(homedir(), "claude", "Cowork OS", "TOPSIM");

/** Mounts POST /api/reports on the local dev server; the logic lives in src/store/saveApi.ts. */
function saveApi(): Plugin {
  return {
    name: "topsim-save-api",
    configureServer(server) {
      server.middlewares.use("/api/periods", (req, res) => {
        const out = req.method === "GET" ? handlePeriodsRequest(VAULT_DIR) : { status: 405, body: {} };
        res.statusCode = out.status;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(out.body));
      });
      server.middlewares.use("/api/reports", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          const out = handleSaveRequest(VAULT_DIR, body, req.headers.origin);
          res.statusCode = out.status;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(out.body));
        });
      });
      // Manual fixes of misread values (PRD Must 1): POST saves one, DELETE undoes one.
      server.middlewares.use("/api/corrections", (req, res) => {
        if (req.method !== "POST" && req.method !== "DELETE") {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          const out = req.method === "POST" ? handleCorrectionRequest(VAULT_DIR, body, req.headers.origin) : handleCorrectionDelete(VAULT_DIR, body, req.headers.origin);
          res.statusCode = out.status;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(out.body));
        });
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
