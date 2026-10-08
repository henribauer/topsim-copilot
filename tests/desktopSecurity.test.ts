import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CSP, externalLinkAllowed, isAppUrl, mimeFor, resolveStaticPath } from "../src/desktop/security";

describe("isAppUrl — the only place the window may be", () => {
  it("is true for the app's own scheme and host only", () => {
    expect(isAppUrl("app://topsim/")).toBe(true);
    expect(isAppUrl("app://topsim/assets/x.js")).toBe(true);
    for (const u of ["app://other/", "app://topsim.evil.example/", "https://topsim/", "file:///etc/passwd", "javascript:alert(1)", "about:blank", "nonsense"]) expect(isAppUrl(u), u).toBe(false);
  });
});

describe("externalLinkAllowed — the few official pages the setup screen links to", () => {
  it("allows Anthropic's install guide and pricing page over https", () => {
    expect(externalLinkAllowed("https://code.claude.com/docs/en/setup")).toBe(true);
    expect(externalLinkAllowed("https://claude.com/pricing")).toBe(true);
  });
  it("refuses everything else: other hosts, lookalikes, credentials in the URL, http, other schemes", () => {
    for (const u of [
      "http://code.claude.com/docs/en/setup",
      "https://evil.example/docs/en/setup",
      "https://code.claude.com.evil.example/docs/en/setup",
      "https://code.claude.com@evil.example/docs/",
      "https://user:pw@code.claude.com/docs/en/setup",
      "https://code.claude.com:8443/docs/en/setup",
      "https://code.claude.com/login",
      "https://claude.com/account",
      "javascript:alert(1)",
      "file:///etc/passwd",
      "app://topsim/",
      "not a url",
    ]) expect(externalLinkAllowed(u), u).toBe(false);
  });
});

describe("resolveStaticPath — files are served from the app folder and nowhere else", () => {
  const root = "/app/dist";
  it("maps / to index.html and a path to the file under root", () => {
    expect(resolveStaticPath(root, "/")).toBe(join(root, "index.html"));
    expect(resolveStaticPath(root, "/assets/a-1.js")).toBe(join(root, "assets", "a-1.js"));
  });
  it("refuses a path that climbs out of root, however it is written", () => {
    for (const p of ["/assets/../favicon.svg", "/../etc/passwd", "/%2e%2e/etc/passwd", "/assets/%2e%2e/%2e%2e/x", "/..%2f..%2fx", "/a\\..\\..\\b", "/a%00b", "/%zz"]) expect(resolveStaticPath(root, p), p).toBeNull();
  });
});

describe("mimeFor + CSP", () => {
  it("knows the file types a Vite build produces", () => {
    expect(mimeFor("a.js")).toBe("text/javascript");
    expect(mimeFor("pdf.worker.min.mjs")).toBe("text/javascript");
    expect(mimeFor("a.css")).toBe("text/css");
    expect(mimeFor("index.html")).toBe("text/html; charset=utf-8");
    expect(mimeFor("favicon.svg")).toBe("image/svg+xml");
    expect(mimeFor("x.bin")).toBe("application/octet-stream");
  });
  it("lets the page load only its own files, no plugins, no framing, no remote scripts", () => {
    expect(CSP).toMatch(/default-src 'self'/);
    expect(CSP).toMatch(/object-src 'none'/);
    expect(CSP).toMatch(/frame-ancestors 'none'/);
    expect(CSP).toMatch(/connect-src 'self'/);
    expect(CSP).not.toMatch(/(?<!wasm-)unsafe-eval|http:|https:|\*/);
  });
});
