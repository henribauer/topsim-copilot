import { describe, expect, it } from "vitest";
import { originAllowed } from "../src/server/origin";

describe("originAllowed", () => {
  it("accepts the dev server, the desktop app's own scheme and requests without an Origin (not a browser)", () => {
    expect(originAllowed("http://127.0.0.1:5181")).toBe(true);
    expect(originAllowed("http://localhost:5181")).toBe(true);
    expect(originAllowed("app://topsim")).toBe(true);
    expect(originAllowed(undefined)).toBe(true);
  });

  it("refuses every other website, lookalike hosts and other schemes", () => {
    for (const o of ["https://evil.example", "http://127.0.0.1.evil.example", "http://localhost.evil.example:80", "app://other", "app://topsim.evil", "file://", "null", ""]) {
      expect(originAllowed(o), o).toBe(false);
    }
  });
});
