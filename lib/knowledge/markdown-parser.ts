import { createHash } from "node:crypto";
import { BodySystem } from "@/lib/generated/prisma/client";
import type { ParsedKnowledgeDocument, ParsedKnowledgeSection } from "./types";

// Deterministic, dependency-free Markdown structuring. No AI is used to
// split headings or infer structure (Phase 7 spec, section 5) — this is
// plain line-based parsing, the same kind of "boring on purpose" code as
// the wearable CSV importers.

const FRONTMATTER_KEYS = ["topic", "bodysystem", "source"] as const;

interface Frontmatter {
  topic?: string;
  bodySystem?: BodySystem;
  source?: string;
  warnings: string[];
}

function parseFrontmatter(raw: string): { frontmatter: Frontmatter; body: string } {
  const warnings: string[] = [];
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return { frontmatter: { warnings }, body: raw };
  }
  const block = match[1];
  const body = raw.slice(match[0].length);
  const fm: Frontmatter = { warnings };
  for (const line of block.split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1].trim().toLowerCase();
    const value = kv[2].trim().replace(/^["']|["']$/g, "");
    if (!value) continue;
    if (!(FRONTMATTER_KEYS as readonly string[]).includes(key)) continue;
    if (key === "topic") fm.topic = value;
    else if (key === "source") fm.source = value;
    else if (key === "bodysystem") {
      const upper = value.toUpperCase() as BodySystem;
      if (Object.values(BodySystem).includes(upper)) {
        fm.bodySystem = upper;
      } else {
        warnings.push(`Unrecognized bodySystem "${value}" in frontmatter — ignored.`);
      }
    }
  }
  return { frontmatter: fm, body };
}

function extractKeywords(heading: string, content: string): string[] {
  const text = `${heading} ${content}`.toLowerCase();
  const words = text.match(/[a-z][a-z0-9'-]{2,}/g) ?? [];
  const stopwords = new Set([
    "the", "and", "for", "are", "but", "not", "you", "your", "with", "this",
    "that", "can", "may", "has", "have", "been", "from", "into", "than",
    "over", "also", "more", "most", "some", "such", "when", "what", "which",
    "while", "about", "these", "those", "will", "does", "each", "per",
  ]);
  const counts = new Map<string, number>();
  for (const w of words) {
    if (stopwords.has(w)) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([w]) => w);
}

export function computeContentHash(raw: string): string {
  return createHash("sha256").update(raw.trim()).digest("hex");
}

/**
 * Parses a Markdown document into a title + heading-delimited sections.
 * `##` headings are section boundaries; a leading `#` is treated as the
 * document title; content before the first `##` (but after any `#` title)
 * becomes an implicit "Overview" section rather than being dropped.
 */
export function parseMarkdownDocument(raw: string, fallbackTitle: string): ParsedKnowledgeDocument {
  const contentHash = computeContentHash(raw);
  const { frontmatter, body } = parseFrontmatter(raw);
  const lines = body.replace(/\r\n/g, "\n").split("\n");

  let title = fallbackTitle;
  let titleFound = false;
  const sections: ParsedKnowledgeSection[] = [];
  let currentHeading: string | null = null;
  let currentLines: string[] = [];
  let order = 0;
  const warnings = [...frontmatter.warnings];

  const flush = () => {
    const content = currentLines.join("\n").trim();
    if (currentHeading && content) {
      sections.push({ heading: currentHeading, content, order: order++ });
    } else if (currentHeading && !content) {
      warnings.push(`Section "${currentHeading}" has no content — skipped.`);
    }
    currentLines = [];
  };

  for (const line of lines) {
    const h1 = line.match(/^#\s+(.+?)\s*$/);
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h1 && !titleFound) {
      title = h1[1];
      titleFound = true;
      continue;
    }
    if (h2) {
      if (currentHeading === null) {
        // Content before the first ## heading — capture as an implicit overview.
        const overview = currentLines.join("\n").trim();
        if (overview) sections.push({ heading: "Overview", content: overview, order: order++ });
        currentLines = [];
      } else {
        flush();
      }
      currentHeading = h2[1];
      continue;
    }
    currentLines.push(line);
  }

  // No ## heading ever appeared — the whole body is one implicit overview.
  if (currentHeading === null) {
    const overview = currentLines.join("\n").trim();
    if (overview) sections.push({ heading: "Overview", content: overview, order: order++ });
  } else {
    flush();
  }

  if (sections.length === 0) {
    warnings.push("No headings or content found — nothing to import.");
  }

  return {
    title,
    topic: frontmatter.topic,
    bodySystem: frontmatter.bodySystem,
    sourceName: frontmatter.source,
    sections,
    contentHash,
    warnings,
  };
}

export function keywordsForSection(heading: string, content: string): string[] {
  return extractKeywords(heading, content);
}
