import { describe, expect, it } from "vitest";
import { extractCitations, numberCitations } from "../src/copilot/citations";

const KNOWN = [
  "Handbook",
  "Lecture: Class Notes.md",
  "Period 0 · TNB11 · Profit and Loss Statement",
];

describe("extractCitations", () => {
  it("lists each cited source once, in order of first use, and marks it as known", () => {
    const text =
      "Tax is 35 % [Handbook]. Net income [Period 0 · TNB11 · Profit and Loss Statement] follows; see [Handbook] again.";
    expect(extractCitations(text, KNOWN)).toEqual([
      { label: "Handbook", known: true },
      { label: "Period 0 · TNB11 · Profit and Loss Statement", known: true },
    ]);
  });

  it("accepts a source with a section added (\"Handbook, 3.5.3 Taxes\") or a report cited by its code only", () => {
    expect(extractCitations("[Handbook, 3.5.3 Taxes] [Handbook §3.5.3] [Period 0 · TNB11]", KNOWN)).toEqual([
      { label: "Handbook, 3.5.3 Taxes", known: true },
      { label: "Handbook §3.5.3", known: true },
      { label: "Period 0 · TNB11", known: true },
    ]);
  });

  it("does not accept look-alikes: another word starting like a source, or another period/report", () => {
    expect(extractCitations("[Handbooks] [Period 1 · TNB11] [Period 0 · TNB1] [Period 0]", KNOWN).map((c) => c.known)).toEqual([
      false, false, false, false,
    ]);
  });

  it("flags a citation that matches none of the sources, so an invented source is visible", () => {
    expect(extractCitations("See [Handbook §3.5.3] and [Lecture: Made Up.md].", KNOWN)).toEqual([
      { label: "Handbook §3.5.3", known: true },
      { label: "Lecture: Made Up.md", known: false },
    ]);
  });

  it("ignores brackets that are not citations (markdown links, checkmarks, plain numbers)", () => {
    expect(extractCitations("Done [x] and [1] and [link](http://a.b) and [ ]", KNOWN)).toEqual([]);
  });
});

describe("numberCitations (D25: numbered inline markers)", () => {
  it("replaces each [label] by a marker ⟦n⟧ with the number of that source in the list", () => {
    const text = "Tax is 35 % [Handbook]. Net income [Period 0 · TNB11 · Profit and Loss Statement], again [Handbook].";
    const cites = extractCitations(text, KNOWN);
    expect(numberCitations(text, cites)).toBe("Tax is 35 % ⟦1⟧. Net income ⟦2⟧, again ⟦1⟧.");
  });

  it("leaves other brackets alone", () => {
    const cites = extractCitations("a [Handbook] [x]", KNOWN);
    expect(numberCitations("a [Handbook] [x]", cites)).toBe("a ⟦1⟧ [x]");
  });
});
