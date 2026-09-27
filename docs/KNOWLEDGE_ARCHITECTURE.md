# Knowledge architecture

Phase 7 added a second, deliberately separate kind of information to
Meridian: **general health knowledge**, as opposed to the **personal
analytics/insights** layer built in Phase 4/4.1
(`docs/ANALYTICS_ARCHITECTURE.md`). The two are never merged and never
treated as equivalent:

| | Personal data → analytics → insights | Health knowledge → general explanation |
|---|---|---|
| What it is | Your own measurements, journal entries, and the deterministic patterns computed from them | Curated notes, imported Markdown, guidelines — information about health in general |
| Where it lives | `BiomarkerMeasurement`, `JournalEntry`, `NormalizedHealthEvent`, `HealthInsight` | `HealthKnowledgeDocument`, `HealthKnowledgeChunk` |
| How it's produced | Deterministic statistics against your own longitudinal data | Deterministic Markdown parsing of curated or imported text |
| Never | Treated as general medical fact | Treated as evidence about you |

The Coach, Body pages, and biomarker pages all keep this distinction visible
in the UI — "Your data suggests…" is never blended with "General knowledge
suggests…" into a single unlabeled sentence.

## Data model

```
HealthKnowledgeDocument
  id, title, sourceType, sourceName?, topic?, bodySystem?, contentHash (unique), metadata

HealthKnowledgeChunk
  id, documentId -> HealthKnowledgeDocument, heading, content, order, keywords (json), bodySystem?, topic?
```

`contentHash` is a sha256 of the raw file content and is the idempotency
key: re-importing byte-identical content is a no-op (see "Import pipeline"
below) rather than creating duplicate chunks. Chunking is deliberately
coarse — one chunk per `##` heading, never an arbitrary token slice — so a
short document can be a single chunk and a well-organized one reads back
exactly the way it was written.

`sourceType` is one of `CURATED`, `USER_NOTES`, `NOTEBOOKLM_EXPORT`,
`GUIDELINE`, `RESEARCH_SUMMARY`, `OTHER`. This is never inferred — the
importer sets it explicitly at import time, and the UI always shows it next
to the content (a knowledge-library card badge, a document-viewer badge, and
a per-excerpt tag in the Coach's evidence list) so a personal note is never
mistaken for guideline-level authority.

## Import pipeline

`lib/knowledge/markdown-parser.ts` is a small, dependency-free, line-based
parser — no Markdown AST library, no AI:

1. An optional `---`-delimited frontmatter block at the top of the file may
   set `topic`, `bodySystem`, and `source` — parsed with a simple
   `key: value` line scan, not a real YAML parser (deliberately minimal for
   three known keys).
2. A leading `# Title` line becomes the document title (or the file name is
   used as a fallback).
3. Every `## Heading` starts a new section; the text up to the next `##`
   (or end of file) becomes that section's content.
4. Any content before the first `##` heading (but after the title) becomes
   an implicit "Overview" section, so nothing written before the first
   subheading is silently dropped.
5. `computeContentHash()` hashes the raw file content for the dedup check
   above.

`lib/knowledge/knowledge.service.ts` wraps this into `inspectMarkdown()`
(pure preview, no DB writes — backs the import wizard's preview step) and
`importMarkdown()` (parses, checks the content hash, and only writes a new
document+chunks if that exact content hasn't been imported before).

The `/knowledge/import` UI never silently imports malformed content: it
always shows the parsed title, detected topic/body system, section list, and
any parser warnings (e.g. "no headings found," "an unrecognized bodySystem
value was ignored") before the user confirms the import, and lets them pick
the honest source type themselves.

## Search — deterministic lexical matching, not RAG

`lib/knowledge/search.service.ts` implements `searchKnowledge(query)` with
plain keyword overlap scoring: a match in a chunk's heading scores highest,
then a keyword-list match, then a topic match, then a bodySystem match, then
plain occurrences in the body text (capped). There is no embedding model, no
vector database, and no external call — this was an explicit constraint for
this phase ("do not introduce a vector database unless absolutely
necessary"; the curated + imported library size for a single-user local app
never approaches the scale where lexical search stops being adequate).

A `bodySystem` filter, when given, is a **hard constraint** — it excludes
non-matching chunks entirely rather than just scoring them lower, even when
a text query is also present. This matters because the Body-system Knowledge
tabs and the biomarker "what can affect it" section both rely on this filter
to stay scoped to the right system; the fix for a bug found during this
phase's own testing (a text query was accidentally allowed to bypass the
bodySystem filter) is covered by
`tests/knowledge-service.test.ts`, "a bodySystem filter is a hard constraint…".

## Where knowledge shows up

- **Body-system pages** (`components/body/*-detail.tsx`, plus the generic
  fallback): the Knowledge tab now renders real `BodyKnowledgeSection`
  results filtered by that system's `BodySystem` enum value, instead of a
  hardcoded paragraph. If nothing has been curated or imported for a system
  yet, it falls back to a short, honest one-line summary and a link to
  `/knowledge` rather than an empty tab.
- **Biomarker pages** (`app/profile/biomarker/[id]/page.tsx`): "What is X" /
  "Why may it matter" (from `BiomarkerDefinition.description` /
  `.whyItMatters`) stay as-is; a new "What can affect it" section below them
  is fed by a `searchKnowledge()` call scoped to that biomarker's name and
  body system, each result carrying a visible source citation — kept
  visually separate from the "Your data" stat grid and trend chart above it.
- **The Coach** (`lib/coach/coach-orchestrator.service.ts`,
  `buildEvidenceItems()`): for each of the (at most 3) chosen priorities, the
  Coach searches the knowledge library using that intervention's title plus
  the user's question, and includes at most one excerpt per priority, capped
  at 4 general-knowledge items total per answer — never the whole library.
  Every included excerpt keeps its `[Source: Document Title — source name]`
  citation inline. If no document matches, it falls back to the small static
  one-liner Phase 6 already had (`STATIC_NOTES` in
  `lib/coach/knowledge-provider.ts`) rather than showing nothing.

## The `HealthKnowledgeProvider` interface

Phase 6 introduced a placeholder seam (`getNote(interventionId)`, backed by
a fixed in-memory map). Phase 7 evolves the same file
(`lib/coach/knowledge-provider.ts`) into the richer interface it always
intended:

```ts
export interface HealthKnowledgeProvider {
  search(query: KnowledgeQuery): Promise<KnowledgeResult[]>;
  getNote(interventionId: string): string | undefined; // kept for the no-match fallback
}
```

`getHealthKnowledgeProvider()` now returns a `DbHealthKnowledgeProvider`
backed by the real search service, with the old static note map kept only as
a graceful fallback for the (increasingly rare) case where nothing in the
library matches. There is still no RAG pipeline and no embeddings anywhere
in this interface.

## Conflicts

No conflict-resolution engine was built, deliberately (the spec doesn't
require one). If two chunks disagree, `searchKnowledge()` returns both as
separate, individually-cited results rather than silently merging them into
one synthesized claim — the Coach's language step is instructed to note
"your imported notes contain differing views on this" when that happens,
rather than picking a winner.

## Curated starter set

`lib/knowledge/curated-seed.ts` ships eight short `CURATED` documents (one
per body system that has a Knowledge tab: brain/sleep, cardiovascular,
liver, kidneys, metabolic, musculoskeletal, gut, immune), covering the exact
topics named in the phase brief — sleep architecture, circadian rhythm, HRV,
resting HR, VO2max, ApoB/LDL, blood pressure, ALT/AST/GGT, creatinine/eGFR,
glucose/HbA1c, fiber, protein distribution, Zone 2, strength training,
recovery/training load, sauna, and cold exposure. Language throughout is
conservative ("may," "is associated with," "can be influenced by") and none
of it is labeled `GUIDELINE` — that source type is reserved for an actually
imported clinical guideline document, never assumed. `prisma/seed.ts` calls
`importMarkdown()` for each of these on every seed run; because import is
idempotent by content hash, re-seeding never duplicates them, and — unlike
the rest of `resetDatabase()` — the knowledge tables are deliberately never
wiped by a demo reset, since curated/imported knowledge isn't "Alex" demo
data and shouldn't disappear when a real user clears their profile data.

## Known limitations

- Lexical search has no stemming/synonym awareness beyond simple substring
  and token matching — "resting heart rate" and "RHR" are not linked unless
  both literally appear somewhere in the indexed text.
- PDF import was not built (Markdown/plain-text only, per the phase's "PDF
  optional if a reusable pipeline exists" allowance — none did, so it was
  left out rather than half-built).
- The curated set is intentionally small (eight documents / ~20 sections) —
  it is a starting point, not an encyclopedia, and is meant to be extended
  by the user importing their own notes or guideline exports.
