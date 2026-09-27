import { describe, it, expect } from "vitest";
import { computeContentHash, parseMarkdownDocument } from "@/lib/knowledge/markdown-parser";

describe("parseMarkdownDocument", () => {
  it("extracts the title, frontmatter, and heading-delimited sections", () => {
    const raw = [
      "---",
      "topic: sleep",
      "bodySystem: brain",
      "source: Personal notes",
      "---",
      "# Sleep Basics",
      "",
      "## Why sleep matters",
      "Sleep supports memory consolidation and recovery.",
      "",
      "## Common disruptors",
      "Late meals, alcohol, and screens close to bedtime.",
    ].join("\n");

    const parsed = parseMarkdownDocument(raw, "fallback");
    expect(parsed.title).toBe("Sleep Basics");
    expect(parsed.topic).toBe("sleep");
    expect(parsed.bodySystem).toBe("BRAIN");
    expect(parsed.sourceName).toBe("Personal notes");
    expect(parsed.sections).toHaveLength(2);
    expect(parsed.sections[0]).toMatchObject({ heading: "Why sleep matters", order: 0 });
    expect(parsed.sections[1]).toMatchObject({ heading: "Common disruptors", order: 1 });
    expect(parsed.warnings).toHaveLength(0);
  });

  it("captures content before the first ## heading as an implicit Overview section", () => {
    const raw = "# My Notes\n\nSome intro text.\n\n## Detail\nMore text.";
    const parsed = parseMarkdownDocument(raw, "fallback");
    expect(parsed.sections[0].heading).toBe("Overview");
    expect(parsed.sections[0].content).toBe("Some intro text.");
    expect(parsed.sections[1].heading).toBe("Detail");
  });

  it("uses the fallback title when no # heading is present", () => {
    const raw = "## Just a section\nContent here.";
    const parsed = parseMarkdownDocument(raw, "Untitled Import");
    expect(parsed.title).toBe("Untitled Import");
  });

  it("warns and produces no sections for empty/whitespace-only content", () => {
    const parsed = parseMarkdownDocument("   \n\n  ", "Empty");
    expect(parsed.sections).toHaveLength(0);
    expect(parsed.warnings.length).toBeGreaterThan(0);
  });

  it("ignores an unrecognized bodySystem value in frontmatter with a warning, not a crash", () => {
    const raw = "---\nbodySystem: not-a-real-system\n---\n## A\ntext";
    const parsed = parseMarkdownDocument(raw, "fallback");
    expect(parsed.bodySystem).toBeUndefined();
    expect(parsed.warnings.some((w) => w.includes("Unrecognized bodySystem"))).toBe(true);
  });

  it("never interprets raw HTML/script tags as structure — they pass through as inert content text", () => {
    const raw = "## Section\n<script>alert(1)</script> some text";
    const parsed = parseMarkdownDocument(raw, "fallback");
    expect(parsed.sections[0].content).toContain("<script>alert(1)</script>");
  });

  it("is deterministic: identical content always hashes identically, byte-different content never collides", () => {
    const a = computeContentHash("## A\nsame content");
    const b = computeContentHash("## A\nsame content");
    const c = computeContentHash("## A\ndifferent content");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
