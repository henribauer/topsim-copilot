import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Redesign step 6, shared polish (design guide R7). One type scale and one card padding for the whole app, so every
 * page reads the same way and nothing is smaller than 12 px. This guards the stylesheet: a new rule with an odd
 * font size or a hand-picked grey fails here instead of slowly making the app busy again.
 */
const css = readFileSync(join(__dirname, "..", "src", "styles.css"), "utf8");
const SCALE = [12, 13, 14, 16, 22, 28, 40];

describe("type scale", () => {
  const sizes = [...css.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]));

  it("only uses the seven sizes of the scale: 12, 13, 14, 16, 22, 28, 40 px", () => {
    const odd = [...new Set(sizes.filter((s) => !SCALE.includes(s)))].sort((a, b) => a - b);
    expect(odd).toEqual([]);
  });

  it("never sets text below 12 px", () => {
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(12);
  });
});

describe("card padding", () => {
  it("is one variable, used by every card-like block", () => {
    expect(css).toMatch(/--card-pad:\s*16px 18px/);
    for (const sel of [".card", ".a-card", ".kpi", ".hero", ".headline"]) {
      const rules = [...css.matchAll(new RegExp(`(^|\\n)${sel.replace(".", "\\.")}\\s*\\{[^}]*\\}`, "g"))].map((m) => m[0]);
      const paddings = rules.flatMap((r) => [...r.matchAll(/(?<![-\w])padding:\s*([^;]+);/g)].map((m) => m[1].trim()));
      for (const p of paddings) expect(p, `${sel} { padding: ${p} }`).toBe("var(--card-pad)");
    }
  });
});

describe("colour", () => {
  it("has one muted grey: no hand-picked light greys for text", () => {
    expect(css).not.toMatch(/color:\s*#9aa0a8/i);
    expect(css).not.toMatch(/color:\s*#adb5bd/i);
  });
});
