import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GLOSSARY, searchGlossary } from "../src/learn/glossary";

const handbook = readFileSync(join(__dirname, "..", "docs", "handbook.txt"), "utf8");
// The lecture script lives in Henri's vault, not in the repo: its checks run only where it exists.
const SCRIPT = join(
  homedir(),
  "claude/Cowork OS/University/Universität/3rd Semester/Managerial Accounting and Controlling/Class Material",
  "Managerial Accounting Script - 0 Front Matter (Introduction and Course Overview).md",
);
const script = existsSync(SCRIPT) ? readFileSync(SCRIPT, "utf8") : null;

describe("GLOSSARY", () => {
  it("has a definition and at least one source for every term, and no term twice", () => {
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(25);
    for (const e of GLOSSARY) {
      expect(e.definition.length, e.term).toBeGreaterThan(20);
      expect(e.sources.length, e.term).toBeGreaterThan(0);
    }
    const names = GLOSSARY.map((e) => e.term.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it("cites only handbook sections that exist as a heading in the handbook", () => {
    for (const e of GLOSSARY) {
      for (const s of e.sources.filter((s) => s.kind === "handbook")) {
        expect(handbook, `${e.term}: Handbook ${s.ref}`).toMatch(new RegExp(`^${s.ref.replace(/\./g, "\\.")}( |$)`, "m"));
      }
    }
  });

  it.skipIf(script === null)("cites only lecture-script places that exist in the script", () => {
    for (const e of GLOSSARY) {
      for (const s of e.sources.filter((s) => s.kind === "script")) {
        expect(script!, `${e.term}: Script ${s.ref}`).toContain(s.ref);
      }
    }
  });

  it("covers the terms the reports and the course are built on", () => {
    const names = GLOSSARY.map((e) => e.term);
    for (const t of ["Contribution margin", "Break-even point", "Overdraft loan", "Success value", "Return on sales", "Liquidity I"]) {
      expect(names, t).toContain(t);
    }
  });
});

describe("searchGlossary", () => {
  it("finds a term by name, ignoring case, and by words in the definition", () => {
    expect(searchGlossary("break-even")[0].term).toBe("Break-even point");
    expect(searchGlossary("OVERDRAFT").map((e) => e.term)).toContain("Overdraft loan");
    expect(searchGlossary("35%").map((e) => e.term)).toContain("Income tax");
  });

  it("ranks a name match above a definition match, and returns everything for an empty query", () => {
    const hits = searchGlossary("contribution margin").map((e) => e.term);
    expect(hits[0]).toBe("Contribution margin");
    expect(searchGlossary("").length).toBe(GLOSSARY.length);
    expect(searchGlossary("zzzz-nothing")).toEqual([]);
  });
});
