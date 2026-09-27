# Data model

This documents the Prisma schema (`prisma/schema.prisma`), why it's shaped
the way it is, and — importantly — which parts of the product are still
backed by static mock data rather than this schema.

## Why SQLite (not PostgreSQL)

The brief allowed either, with SQLite as the fallback "if PostgreSQL
introduces unnecessary friction." For a local-first, single-user desktop-like
app with no concurrent writers, a Docker-hosted Postgres instance adds an
extra moving part (a daemon that must be running before `npm run dev` works)
for no benefit this phase actually needs. SQLite is a single file
(`data/app.db`), needs no service to start, and is trivial to inspect, copy,
or reset.

The schema was written to stay boring and portable on purpose — no
SQLite-specific tricks beyond the one required accommodation:
- Array-shaped fields (`BiomarkerDefinition.aliases`, `Goal.bodySystems`) are
  stored as a Prisma `Json` column containing a plain `string[]`, since
  SQLite has no native array type. Postgres supports both native arrays and
  `Json`/`Jsonb`; moving to Postgres would mean either keeping the `Json`
  columns as-is (they map directly) or migrating them to real `String[]`
  columns as a small follow-up migration.
- Everything else (enums, relations, indexes, cascading deletes) is
  standard Prisma and needs no schema changes to run on Postgres — only the
  `datasource` provider and connection string change.

One real Prisma-7-specific wrinkle: Prisma 7 removed the implicit
query-engine-binary connection and requires an explicit **driver adapter**
(`lib/db/prisma.ts` constructs `PrismaBetterSqlite3` from
`@prisma/adapter-better-sqlite3`). Moving to Postgres means swapping that one
adapter for `@prisma/adapter-pg` — nothing else in the repository talks to
the adapter directly, since all Prisma access goes through `lib/db/prisma.ts`.

## Layering

```
app/*  (Server Components + Server Actions)
   │  never import Prisma directly
   ▼
lib/services/*        business logic, DB row -> UI-type mapping
   │
   ▼
lib/db/repositories/*  thin typed wrappers around prisma.<model>.*
   │
   ▼
lib/db/prisma.ts        the one Prisma Client instance
```

Routes and components import services, not repositories or Prisma models
directly (the one narrow exception: `lib/services/profile.service.ts`
re-exports `medicalRepo` for the profile actions to call directly, since
medical history/medication/supplement CRUD has no extra business logic worth
a service-layer indirection). Services own all DB-row → UI-type mapping,
which is what lets most of the Phase 1 components (`BiomarkerCard`,
`GoalCard`, `JournalEntryCard`, ...) keep working completely unchanged —
they still receive the same shapes defined in `types/health.ts`; only where
that data comes from changed.

## Core entities

### Profile & medical background
`UserProfile` — one row, always (the service layer's `getOrCreateProfile()`
enforces this; there's no auth or multi-tenancy yet, so "the current user" is
just "the first profile row"). `MedicalHistory`, `Medication`, and
`Supplement` all belong to it. `MedicalHistory.status` (clinical state:
active/managed/resolved/suspected/historical) is deliberately a separate
field from `MedicalHistory.source` (provenance: self-reported / doctor
diagnosed / from an imported document / AI-extracted) — a condition can be
"active" and "self-reported" at the same time; conflating the two would lose
information the UI needs to avoid implying more certainty than exists.

### Biomarkers — the most important design decision in this schema
`BiomarkerDefinition` (what a metric *is* — ApoB, HRV, Sleep Score, ...) is
separate from `BiomarkerMeasurement` (one immutable timestamped datapoint).
This is standard "master data vs. time series" modeling, but the choice that
matters most here: **lab values and wearable-style metrics share the same
two tables.** ApoB and HRV are both a `BiomarkerDefinition` with a stream of
`BiomarkerMeasurement` rows; they differ only in `sourceType` (`LAB_REPORT`
vs `WEARABLE`) and which `bodySystem`/`category` they're tagged with. This is
what makes the schema "ready for a future wearable integration" as asked:
adding real Amazfit/Zepp sync later means writing `BiomarkerMeasurement` rows
with `sourceType: WEARABLE`, not designing a new table.

`BiomarkerMeasurement` rows are never edited or overwritten after creation
(the one exception: an unconfirmed extraction's value can be corrected during
review, before it produces a measurement at all — see below). A correction to
verified history is a new row, so the full trend is always reconstructable.

`aliases` (JSON string array) is what lets `lib/services/biomarker.service.ts`
resolve an extracted lab field name like `"Apo B"` or `"Apolipoprotein-B"`
back to the canonical `apob` definition — see `lib/domain/biomarker-catalog.ts`
for the seeded alias lists.

### Documents & the extraction pipeline
`HealthDocument` stores metadata only — `localFilePath` is a filename under
`HEALTH_UPLOADS_DIR` (default `data/uploads/`), and the actual bytes never
touch the database. This matters for the privacy story (see
`PRIVACY_ARCHITECTURE.md`) as much as for the "don't put binaries in SQLite"
practicality.

Uploading a document does **not** create verified biomarker measurements.
It creates a `LabExtractionSession` (one per extraction attempt) containing
`LabExtractionItem` rows (one per detected field) with:
- `suggestedBiomarkerDefinitionId` — what the alias resolver *guessed*
- `finalBiomarkerDefinitionId` — what was actually used (equal to the
  suggestion unless a human changes it during review — the review UI doesn't
  currently expose changing this, but the field exists for that)
- `accepted` — whether this item should be imported at all (any extractor,
  mock or real, pre-unchecks anything below a confidence threshold)
- `editedByUser` — set once a human touches the value, so a real extractor's
  confidence score can be understood as "as extracted" vs. "human-corrected"
- `resultingMeasurementId` — set the moment this item produces a real
  `BiomarkerMeasurement`, and checked before importing again. This is what
  makes "Save to Health Profile" idempotent: confirming the same session
  twice (a double-click, a retried request) never creates duplicate history.

Only `lib/services/extraction.service.ts#confirmExtraction` ever writes a
`BiomarkerMeasurement` from an extraction, and only for items that are both
`accepted` and resolved to a definition. This is the literal implementation
of "uploading a document must not immediately create verified biomarker
measurements."

### AI extraction (real, provider-agnostic)
`lib/extraction/types.ts` defines `LabDocumentExtractor`, an interface with
one method (`extract(document): Promise<LabDocumentExtractionResult>`).
Two implementations exist:
- `lib/extraction/mock-extractor.ts` — a fixed, realistic panel, ignoring the
  actual file. This is the default with no AI provider configured.
- `lib/extraction/ai-lab-extractor.ts` — sends the actual document (PDF or
  image) to a real multimodal model and validates its JSON response against
  a Zod schema before it's trusted.

`lib/extraction/index.ts#getLabDocumentExtractor()` is the only place that
decides which implementation is active — it asks `lib/ai/index.ts#getAiProvider()`
whether a provider is configured and falls back to the mock if not. Nothing
upstream (`extraction.service.ts`, the upload Server Action, the review UI)
knows or cares which one ran; both produce the exact same
`LabDocumentExtractionResult` shape, so marker-matching
(`resolveDefinitionByRawName`), the confidence threshold, and the
review/confirm flow are identical either way.

The provider itself is a second, smaller abstraction
(`lib/ai/types.ts#AiProvider` — "send text + optional attachments, get text
back") implemented by `AnthropicProvider` and `OpenAiProvider`
(`lib/ai/anthropic-provider.ts`, `lib/ai/openai-provider.ts`). Which one is
active is chosen once, by `AI_PROVIDER` + the matching API key env var — see
`.env.example`. `lib/ai/structured.ts#completeStructured()` is the shared
helper both extractors (lab and journal) use to turn a provider's free-text
response into validated, typed data; a response that fails JSON parsing or
schema validation throws `AiProviderError` rather than being trusted.

A real extraction call can fail (bad key, network error, malformed model
output, unreadable file). `extraction.service.ts#startExtraction` catches
that and moves the session to `ExtractionStatus.FAILED` with the error
message recorded in `rawExtraction`, rather than throwing past the Server
Action or leaving the review screen stuck on a spinner — see the "no
historical measurements / extraction failed" error state in the upload UI.

### Journal
`JournalEntry.text` is the only field the user's raw words ever live in, and
nothing in the codebase ever mutates it after creation.
`JournalObservation` rows are a *separate*, derived layer — `type` (a fixed
enum: mood, sleep, food, training, symptom, ...), a human-readable `label`,
and a `source` (currently always `AI_EXTRACTED`). Deriving observations from
text never touches the entry's `text` column.

Observation extraction mirrors the lab pipeline exactly:
`lib/journal-extraction/types.ts#JournalObservationExtractor` is the
interface, `mock-extractor.ts` wraps the original Phase 1 keyword-matching
pass (`lib/journal-analysis.ts`), and `ai-extractor.ts` sends the entry's raw
text to the configured provider with a prompt that explicitly forbids
inferring anything not actually stated. `lib/journal-extraction/index.ts#getJournalObservationExtractor()`
is the one switch point, chosen the same way as the lab extractor. If
extraction throws for any reason, `journal.service.ts#createJournalEntryWithAnalysis`
still saves the entry — with zero observations — rather than losing the
user's writing over an API hiccup.

### Goals
The spec's field list didn't include `kind` or `progress`, but the product
description explicitly distinguishes one long-term goal from supporting
goals and temporary projects, and the existing UI renders a progress bar —
so both were added. `kind` (`LONG_TERM` / `SUPPORTING` / `PROJECT`) is
separate from `category` (`CARDIOVASCULAR`, `SLEEP`, ...) because they answer
different questions: "how important/permanent is this" vs. "what does it
affect." `parentGoalId` is a self-relation, currently used to link
supporting goals to the long-term goal in seed data, though the UI doesn't
yet visualize the hierarchy beyond grouping by `kind`.

### Experiments
`HealthExperiment` holds the hypothesis/protocol/dates; `ExperimentOutcome`
rows declare *what's being tracked* (`metricType` + an optional
`metricReference`, e.g. the biomarker canonical key `"hrv"`). No outcome
*values* are stored — `lib/services/experiment.service.ts#computeSnapshot`
computes a live baseline (mean of the 14 days before `startDate`) vs.
current (mean of the trailing 7 days up to `endDate` or now) from real
`BiomarkerMeasurement` rows, entirely on read. This is plain aggregation
(an average), explicitly not statistical inference — there's no significance
test, confidence interval, or causal claim, matching the "no advanced
statistical pattern detection" boundary for this phase.

### Timeline
There is deliberately no `TimelineEvent` table.
`lib/services/timeline.service.ts#buildTimeline()` aggregates events live
from `BiomarkerMeasurement` (grouped by day into one "lab panel" card per lab
visit), `JournalEntry`, `Goal` (projects only), and `HealthExperiment`, sorts
them, and merges in whatever's still mock (see below). Duplicating all of
that into a denormalized timeline table would just be a second source of
truth to keep in sync for no real benefit at this data scale.

### Coach orchestration (Phase 6)

`Goal` gained three optional, additive fields (`timeHorizon`, `rationale`,
`successCriteria`) — no existing field or enum was changed. Two new models
support the Coach: `HealthMode` (a temporary prioritization modifier, e.g.
"Judo competition prep" boosting `RECOVERY` and suppressing `STRENGTH`
candidates — separate from `Goal` because a mode isn't a tracked objective)
and `CoachPriority` (only ever created by explicit user acceptance of a
suggested priority — never automatically). The intervention catalog itself
(`lib/coach/intervention-catalog.ts`) is deliberately a static code file, not
a database table — see `docs/COACH_ARCHITECTURE.md` for the full pipeline
(context building, candidate generation, deterministic scoring, safety
classification, and the LLM's phrasing-only role).

## Real-user mode (V1 hardening)

Demo mode and real mode are separate data states, driven by
`AppSettings.demoMode` — not a UI filter layered on top of shared data:

- A **freshly migrated database that has never been seeded** defaults to
  `demoMode: false` the first time anything reads `AppSettings`
  (`lib/services/settings.service.ts`) — real mode from the very first page
  load, no manual toggle required.
- `prisma/seed.ts` explicitly sets `demoMode: true` after it finishes
  seeding the "Alex" persona, so a seeded database always identifies itself
  correctly.
- `getOrCreateProfile()`'s auto-created fallback profile is named `"You"`
  (`NEUTRAL_PROFILE_FIRST_NAME`), never `"Alex"` — a real user who never
  seeds should never silently end up looking like the demo persona.
- In real mode: the Home "Today" panel shows real Sleep/HRV/Resting
  HR/Stress values with a baseline delta (never a computed composite
  "readiness" score); `buildTimeline()` excludes the legacy mock event types
  (training/illness/weight/supplement/wearable — see "What's still mock"
  below); `BodySystemCard`/`SystemPanelHeader` show a plain data-presence
  status ("Data logged" / "More data needed") instead of the demo dataset's
  fabricated per-system health judgment ("Stable — lipids and heart metrics
  are within personal targets…").
- `scripts/check-safe-to-reset.ts` and `prisma/seed.ts`'s own
  `guardAgainstRealData()` both refuse to run once `AppSettings.demoMode`
  is `false`, in addition to their pre-existing check for a real,
  successfully-imported wearable data source — the first check alone
  missed a real user who'd only uploaded labs, journaled, or set goals
  without ever connecting a wearable.

## Real lab extraction (V1 bug-fix + UX hardening round)

A real user's hormone-panel upload previously showed a fabricated lipid
panel (ApoB 74, LDL-C 101, …) — `lib/extraction/index.ts`'s
`getLabDocumentExtractor()` chose `MockLabDocumentExtractor` purely based on
whether an AI provider was configured, with no check on `demoMode` at all.
Fixed:

- `getLabDocumentExtractor()` now only returns the mock when
  `AppSettings.demoMode` is `true`; in real mode with no provider
  configured, it returns `UnavailableLabDocumentExtractor`, which throws a
  specific, actionable error ("no AI extraction provider is configured…")
  that `startExtraction()` turns into a `FAILED` session — the same
  existing failure path real provider errors already used, now reused for
  this case too rather than inventing a new state.
- A second, independent guard inside `startExtraction()` itself refuses to
  proceed if the resolved extractor is ever `mock-v1` while `demoMode` is
  `false`, regardless of how it was obtained — defense in depth against a
  future refactor reintroducing the bug via a different path.
- `lib/actions/documents.ts` surfaces the session's actual stored failure
  reason (`getExtractionFailureReason()`) instead of one hardcoded generic
  message, and the upload wizard now offers **Set up AI extraction**,
  **Enter a value manually** (a new minimal manual-entry dialog,
  `components/profile/add-manual-biomarker-dialog.tsx` /
  `lib/actions/biomarkers.ts`, always `sourceType: MANUAL`), and **Try
  again** — never a substitute measurement.
- Extracted fields are now sanitized (`sanitizeExtractedFields()`): a
  non-finite value, blank name/unit, out-of-range confidence, or exact
  duplicate is dropped before it ever becomes a `LabExtractionItem` row.
- Review UI confidence is now a 4-tier system (`ExtractedLabValue.confidenceTier`:
  `high`/`medium`/`low`/`unrecognized`) instead of one boolean `flagged` —
  an item with no matching `BiomarkerDefinition` is always `unrecognized`
  regardless of its numeric confidence, is never auto-accepted, and stays
  visible with a biomarker-mapping dropdown (backend support for
  `finalBiomarkerDefinitionId` already existed; the UI to use it did not).
- **Honesty note**: both `AnthropicProvider` and `OpenAiProvider`
  (`lib/ai/*-provider.ts`) do have real, correctly-shaped PDF/image
  attachment handling (Anthropic's native `document` content block;
  OpenAI's `input_file`/`input_image`) — but neither has been exercised
  against a live API call in this environment, since no `AI_PROVIDER` is
  configured here. Real extraction is implemented, not verified end-to-end
  with a real key.

## Internationalization (P1)

`lib/i18n/` — a small, dependency-free, centralized dictionary system (not
`next-intl` or similar): `lib/i18n/dictionaries/{en,de,ru}.ts` are plain
nested objects typed against `en`'s shape (`satisfies Dictionary`), so a
missing key in `de`/`ru` is a compile error. `translate()`
(`lib/i18n/get-dictionary.ts`) does dot-path lookup with `{placeholder}`
interpolation — no ICU pluralization; the few plural-sensitive Russian
strings are phrased as "Count: N" to sidestep it. `AppSettings.locale`
(new column, additive migration) is the persisted choice;
`lib/i18n/server.ts`'s `getTranslations()` is for Server Components,
`lib/i18n/locale-provider.tsx`'s `useTranslations()` (via a `LocaleProvider`
mounted once in the root layout) is for Client Components. The Coach's
language step (`lib/coach/language.service.ts`) appends an explicit
"Respond in German/Russian" line to its fixed system prompt when locale
isn't English — the JSON payload deciding *what* to say never changes, only
the model's output language.

**Coverage**: navigation, Home, the Profile page's own sections (not its
sub-dialogs — Add condition/medication/supplement remain English), the
lab-upload wizard and manual-biomarker dialog, Data Management, Privacy &
AI, and the Coach input/disclaimer. **Not translated**: Body/Journal/Goals/
Experiments/Insights/Timeline/Knowledge page bodies, body-system names
(`lib/mock-data/body-systems.ts`), the `StatusPill` status labels, and every
dialog not listed above — verified live in-browser (switching to German
correctly re-rendered every covered screen; uncovered screens correctly
stayed English rather than showing a broken key). Clinical identifiers
(ApoB, HbA1c, TSH, …) are never touched — they live only in
`lib/domain/biomarker-catalog.ts`, which no dictionary references.

## Body Explorer redesign (P2)

`components/body/organs/` — one small file per system (`brain-organ.tsx`,
`heart-organ.tsx`, `liver-organ.tsx`, `kidneys-organ.tsx`, `gut-organ.tsx`,
`lungs-organ.tsx`, `immune-organ.tsx`, `metabolic-organ.tsx`,
`musculoskeletal-organ.tsx`), each a small schematic SVG fragment (plain
shapes — an ellipse-and-wrinkle-lines brain, a two-lobe heart with a pulse
line, a bean-pair for kidneys, a coiled line for gut, an abstract hex+spark
glyph for "metabolic" since it has no single organ) taking an `emphasis:
"dim"|"normal"|"highlighted"` prop, mapped by `BodySystemId` in
`components/body/organs/index.tsx`. `components/body/body-visualization.tsx`
keeps its exact previous prop interface (`systems`/`activeId`/`hoveredId`/
`onHover`) — `body-explorer-shell.tsx` needed zero changes — and now renders
these organs at the same anatomical hotspot coordinates the old dot-map
used, with a small secondary status ring (not the primary representation
anymore) beside each. Selecting/hovering a system brings its organ to full
opacity and dims every other one. No fabricated per-organ health state —
verified live that Liver's own page still correctly says "No liver panel
data yet."

## Performance (V1 bug-fix round)

Found one real, fixable N+1: `getAppSettings()` (the `AppSettings`
singleton read) was being re-fetched independently up to ~8 times on a
single Home page render — once per `BodySystemCard` (×6), once from the
root layout's locale read, once from the demo-mode banner. Fixed by
wrapping it in React's per-request `cache()` (`lib/services/settings.service.ts`)
— de-dupes identical calls within one render pass only, never stale across
a Server Action's own separate request. Page loads against the current
(tiny, real) local dataset were already sub-20ms before this fix, so it's a
correctness/scalability improvement more than an observed fix; a deeper
client-bundle-size audit was not performed this round.

## What's still mock

Per the "migrate feature by feature, don't remove all mock data at once"
instruction, these are intentionally untouched:

- **Lab and journal extraction default to mock**, not because they can't be
  real, but because that's the safe, zero-config default (see
  `docs/PRIVACY_ARCHITECTURE.md`). Set `AI_PROVIDER` in `.env` to switch both
  to real multimodal/LLM extraction — see "AI extraction" above.
- **`lib/mock-data/coach-responses.ts`** — the Coach is explicitly out of
  scope ("no real AI Coach responses").
- **`lib/mock-data/insights.ts`** — still used for each Body system detail
  page's own illustrative "relationships" example content; unrelated to the
  real, DB-backed `HealthInsight` pattern engine (see
  `docs/ANALYTICS_ARCHITECTURE.md`), which every Body page also surfaces
  live under "Relevant insights."
- **`lib/mock-data/timeline.ts`** — the `training`/`illness`/`weight`/
  `supplement`/`wearable` event types remain mock (no dedicated model yet —
  a manually-logged training session, illness episode, weigh-in, or
  supplement start/stop date isn't modeled as its own timeline-worthy
  event). As of the V1 hardening pass, `buildTimeline()` only merges these
  in when `AppSettings.demoMode` is `true` — real mode never shows them
  (see "Real-user mode" above).
- **`lib/mock-data/sources.ts`** — `connectedSources` (the fabricated Quest
  Diagnostics/Viome/InBody "connected" list) is no longer rendered anywhere
  as of Phase 7's mock audit — it implied live provider integrations that
  don't exist. The Profile page's Data Sources section now shows only the
  real `HealthDataSource` (wearable) row plus an honest note that lab
  reports arrive via document upload, not a live connection. `labDocuments`
  in the same file is unused dead data left for a future real lab-provider
  integration to reuse or remove.

### Wearable ingestion (Phase 5)

Real Amazfit/Zepp (and generic-CSV) import replaced the wearable dashboard
mock entirely — see `docs/WEARABLE_ARCHITECTURE.md` for the full connector
architecture, canonical metric catalog, deduplication strategy, and
demo/real data isolation. In schema terms: `HealthDataSource` (one row per
connectable source), `WearableImportSession` (one row per import attempt,
the audit trail behind the Profile "Import history" list), `SleepSession`
and `WorkoutSession` (richer structured objects a single `BiomarkerMeasurement`
row can't represent), and two new nullable fields on `BiomarkerMeasurement`
itself — `dataSourceId` and `externalId` — which is also how a real import is
distinguished from Phase 2-4's demo-seeded wearable rows (demo rows have
neither set).
- **`lib/mock-data/daily.ts`** — deleted in the V1 hardening pass.
  `readinessScores` was a fixed, never-computed set of 4 percentages shown
  unconditionally regardless of any actual data; Home's "Today" panel now
  shows real Sleep/HRV/Resting HR/Stress values with a baseline delta
  instead (see "Real-user mode" above). `components/health/readiness-ring.tsx`
  was deleted alongside it, having no other caller.

Everything else described in the "Primary objectives" — profile, journal,
goals, experiments, biomarkers (lab-sourced), documents, and the extraction
pipeline — reads and writes real data through the layers above.

### Knowledge layer & app settings (Phase 7)

Two new models, deliberately kept separate from everything above:
`HealthKnowledgeDocument`/`HealthKnowledgeChunk` (general health knowledge —
see `docs/KNOWLEDGE_ARCHITECTURE.md` for the full design) and `AppSettings`
(a single `id: "singleton"` row holding `demoMode` and `externalAiEnabled` —
local app configuration, not personal health data, which is why it lives
outside `UserProfile`). Both are additive; no existing table changed shape.

As part of this phase's mock/demo audit, `components/body/gut-detail.tsx`'s
hardcoded per-organ narrative (`sections`, e.g. "No reflux logged in the past
30 days," "Calprotectin trending down") was removed — it read as computed
personal analysis but was static fabricated text with no backing data.
The 6 body-system detail components' "What this system covers" paragraphs
were likewise replaced by real `HealthKnowledgeChunk` lookups
(`components/body/body-knowledge-section.tsx`) rather than component-local
strings — see `docs/KNOWLEDGE_ARCHITECTURE.md`, "Where knowledge shows up."
