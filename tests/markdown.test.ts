import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../src/copilot/markdown";

describe("parseMarkdown", () => {
  it("turns headings, paragraphs, lists and bold into blocks", () => {
    const blocks = parseMarkdown("## Net Income\n\nIt is **207.66** TEUR.\n\n- one\n- two\n\n1. first\n2. second");
    expect(blocks).toEqual([
      { type: "heading", level: 2, inline: [{ text: "Net Income" }] },
      { type: "paragraph", inline: [{ text: "It is " }, { text: "207.66", bold: true }, { text: " TEUR." }] },
      { type: "list", ordered: false, items: [[{ text: "one" }], [{ text: "two" }]] },
      { type: "list", ordered: true, items: [[{ text: "first" }], [{ text: "second" }]] },
    ]);
  });

  it("splits ⟦n⟧ citation markers out of the text so the page can link them", () => {
    const [p] = parseMarkdown("Tax is 35 % ⟦1⟧, net ⟦2⟧.");
    expect(p).toEqual({
      type: "paragraph",
      inline: [{ text: "Tax is 35 % " }, { cite: 1 }, { text: ", net " }, { cite: 2 }, { text: "." }],
    });
  });

  it("keeps HTML as plain text — the answer is never injected as markup", () => {
    const [p] = parseMarkdown("<img src=x onerror=alert(1)> **b**");
    expect(p).toEqual({ type: "paragraph", inline: [{ text: "<img src=x onerror=alert(1)> " }, { text: "b", bold: true }] });
  });

  it("drops horizontal rules and keeps a single line break inside a paragraph as a space", () => {
    const blocks = parseMarkdown("line one\nline two\n\n---\n\nafter");
    expect(blocks).toEqual([
      { type: "paragraph", inline: [{ text: "line one line two" }] },
      { type: "paragraph", inline: [{ text: "after" }] },
    ]);
  });
});
