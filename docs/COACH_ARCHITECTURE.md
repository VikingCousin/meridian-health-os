# Coach architecture — orchestration, prioritization, safety

Phase 6 replaced the Coach's keyword-matched canned responses with a real
orchestration pipeline. It is **not a diagnostic system**, **not an
autonomous treatment engine**, and **not a substitute for medical care** —
every design decision below exists to keep those boundaries real rather than
aspirational.

## The pipeline

```
USER REQUEST
    ↓
SAFETY CLASSIFICATION          lib/coach/safety.service.ts — runs FIRST, always
    ↓ (short-circuits here for higher-risk classifications)
COACH CONTEXT BUILDER          lib/coach/context-builder.service.ts
    ↓
DETERMINISTIC CANDIDATE GEN.   lib/coach/candidate-generation.service.ts
    ↓
DETERMINISTIC PRIORITIZATION   lib/coach/prioritization.service.ts (+ conflict.service.ts)
    ↓
OPTIONAL LLM LANGUAGE GEN.     lib/coach/language.service.ts
    ↓
TRACEABLE RESPONSE             lib/coach/coach-orchestrator.service.ts assembles CoachResponse
```

The LLM never browses the database. Application code decides what
structured context is relevant and hands the model a small, already-decided
JSON payload to phrase — it cannot fetch anything itself.

## Context builder

`buildCoachContext()` returns a `CoachContext` — the *only* data the rest of
the pipeline (and, later, the LLM) ever sees. Every field is bounded:

- **Goals**: active only (not completed/abandoned), capped at 8.
- **Insights**: active/watching/confirmed only, sorted by recency, capped at 5.
- **Biomarkers**: a small curated set (default: HRV, sleep duration, sleep
  score, resting HR, training load, stress level) plus any metric an active
  insight or goal category implies — capped at 6. For an `explain_metric`
  intent, only that one metric is fetched.
- **Journal observations**: last 14 days, tags/categories only (never raw
  text is passed further than this layer — see "Data minimization" below),
  capped at 20.
- **Health modes**: active only.
- **Safety context**: medication/supplement/condition **names only**, never
  doses or details.

A small deterministic intent router (`lib/coach/intent-router.service.ts`)
classifies the question (`weekly_focus`, `explain_metric`, `explain_recovery`,
`goal_progress`, `pattern_question`, `experiment_suggestion`, `general`) via
regex, the same style as the existing journal keyword tagger — never an LLM
call. This is what tells the context builder which biomarker to fetch for
"explain my ApoB trend," for example.

## Goal hierarchy

The existing `Goal` model (`kind`: `LONG_TERM`/`SUPPORTING`/`PROJECT`) already
mapped onto NORTH_STAR / SUPPORTING_GOAL / TEMPORARY PROJECT — Phase 6 only
added the fields the spec's "goal relationships" section needed and didn't
already have: `timeHorizon` (`LONG_TERM`/`QUARTER`/`MONTH`/`TEMPORARY`),
`rationale`, and `successCriteria`, all optional and additive. The existing
`GoalStatus` enum (`ON_TRACK`/`ATTENTION`/`PREPARATION`/`COMPLETED`/`ABANDONED`)
was **not** replaced with the spec's suggested `ACTIVE`/`PAUSED`/`COMPLETED`/
`ARCHIVED` — that would have touched every existing Goal UI/service built in
Phase 2. Instead, "active" for Coach purposes means "not completed and not
abandoned," which covers the existing five statuses without a schema change.
The UI-facing `Goal` type also newly exposes `category` (previously DB-only)
since candidate generation needs it for goal-to-intervention matching.

## Health modes

`HealthMode` is a new, separate model — not a Goal — because a mode is a
*temporary prioritization modifier*, not a tracked objective with progress.
`priorityModifier` is a small JSON object: `{boostCategories: [...],
suppressCategories: [...]}`, referencing `InterventionCategory` values. The
seed data's "Judo competition prep" mode boosts `RECOVERY` and suppresses
`STRENGTH` — demonstrating the spec's own example (recovery/performance
temporarily outranking hypertrophy work). There's no mode-management UI this
phase; modes are seeded/managed directly, and their effect is visible
through the prioritization breakdown's `modeModifier` component.

## Intervention library

`lib/coach/intervention-catalog.ts` is a **static, code-maintained catalog**
— deliberately not a database table and not user-generated content, per the
spec. 17 entries across all 10 categories (SLEEP, NUTRITION, CARDIOVASCULAR,
STRENGTH, AEROBIC, RECOVERY, STRESS, BEHAVIOR, ENVIRONMENT,
MEDICAL_FOLLOWUP). Each entry carries `evidenceLevel`, `burden`, `riskLevel`,
`timeCost`, `costLevel`, `measurementOptions` (canonical metric keys),
`contraindicationNotes`, `requiresMedicalReview`, and
`relevantExposureTypes` (which `NormalizedEventType`s — from the Phase 4
pattern engine — this intervention addresses). Nothing here claims universal
appropriateness; several entries carry explicit contraindication notes
(cold exposure vs. hypertrophy goals, sauna vs. acute illness, etc.).

## Candidate generation (deterministic, no LLM)

`generateCandidates()` produces one candidate per matching intervention from
two sources:

1. **Personal pattern**: an active insight's `exposureType` (e.g.
   `LATE_MEAL`) matches an intervention's `relevantExposureTypes` →
   candidate with `reasonType: "personal_pattern"`, linked to that insight.
2. **Goal alignment**: an active goal's `category` (e.g. `CARDIOVASCULAR`)
   matches an intervention's `supportedGoalCategories` → candidate with
   `reasonType: "goal_alignment"`, linked to that goal.

If both apply, the candidate keeps the `personal_pattern` reason (the
stronger, more specific signal) but accumulates *all* matching goal links —
"why this, why now" should show every relevant goal, not just the first
found. No two candidates are ever created for the same intervention.

## Prioritization engine (deterministic, no LLM)

`scoreCandidates()` in `lib/coach/prioritization.service.ts` computes a
transparent, additive breakdown per candidate:

| Component | Range | Basis |
|---|---|---|
| `goalAlignment` | 0–20 | 8 per linked goal, capped |
| `personalEvidence` | 0–20 | 0 for goal-only candidates; 5/10/15/20 by insight confidence (early/possible/moderate/strong) |
| `expectedImpact` | 0–20 | by intervention `evidenceLevel` (established=20 ... unknown=2) |
| `measurementClarity` | 0–15 | 5 per measurable outcome metric, capped |
| `burdenPenalty` | 0/-5/-10 | by intervention `burden` |
| `riskPenalty` | 0/-5/-12 | by intervention `riskLevel` |
| `conflictPenalty` | ≤0 | from `conflict.service.ts`, see below |
| `modeModifier` | any | +8 per active mode boosting this category, -8 per mode suppressing it |
| `recentExperimentPenalty` | 0/-10 | if an active experiment already tracks every one of this intervention's outcome metrics |
| `dataQualityPenalty` | 0/-3/-8 | by `context.dataQuality.overallStatus` |

The total is clamped to [0, 100]. **This is a product-priority score, not a
measure of medical probability or clinical efficacy** — the same discipline
Phase 4's confidence engine established for personal-pattern confidence.

### Limiting active priorities

`MAX_ACTIVE_PRIORITIES = 3`. `selectTopPriorities()` sorts by score and
takes the top 3, rendered as **primary / secondary / optional** — Meridian
never shows a long list of "17 things you could optimize."

### Conflicts

`lib/coach/conflict.service.ts` encodes a small, explicit set of
product-level cautions — not a medical rules engine:

- A high-demand intervention (`vo2max-intervals`, `strength-training`)
  alongside an active `ILLNESS_RECOVERY` mode → caution, penalty.
- `cold-exposure` selected alongside `strength-training` in the same
  candidate set → caution about blunting hypertrophy adaptations.

Every conflict is a caution (shown in the UI, subtracted from score) —
**never a hard block**. A third conflict from the spec ("aggressive caloric
deficit + high training load") was not implemented: Meridian doesn't track
caloric deficit as a signal, and inventing a proxy trigger risked false
positives worse than saying nothing — documented here as a known gap rather
than guessed at.

## Safety layer

`lib/coach/safety.service.ts` classifies every question, **before** context
building or any LLM call, into one of four levels:

- `GENERAL_WELLNESS` — no personal-data reference, nothing concerning.
- `PERSONAL_HEALTH_CONTEXT` — references the user's own data/situation,
  nothing concerning.
- `MEDICAL_REVIEW_RECOMMENDED` — medication dosage/stopping questions, drug
  interaction questions, diagnosis requests, extreme fasting, persistent/
  severe symptoms.
- `URGENT_MEDICAL_ATTENTION` — chest pain, breathing difficulty, stroke-like
  symptoms, suicidal ideation, injury with neurological symptoms, etc.

**Both of the higher-risk classifications short-circuit the entire pipeline**
in `askCoach()`: no context is built, no candidates are scored, no LLM is
called — the fixed safety message is returned directly, and
`suggestedFollowUpQuestions` for the medical-review case offers a way back
("What should I focus on this week?") rather than leaving the user stuck.
**The LLM never sees these questions and cannot override the classification**
— it isn't in the call path at all for these cases. This is a deterministic
keyword classifier (same pattern as the existing journal-analysis.ts
tagger), not a medical triage system — it does not diagnose, and a false
negative (missing something) is always possible. When in doubt, a real
clinician or emergency service is the right next step, not this app.

## LLM role — explanation only

`lib/coach/language.service.ts` calls the existing provider-agnostic
`AiProvider` (the same abstraction lab/journal extraction use) only for
**phrasing**: `summary`, `observationNotes[]`, `followUpQuestions[]` — see
`lib/validation/coach.ts`'s `coachLanguageSchema`. The prompt explicitly
forbids the model from calculating anything, inventing a goal/pattern/
priority/number, recommending a medication change, or overriding the safety
classification. The schema itself enforces this structurally: there is no
field for a priority, a score, or a goal — even a model that ignored the
instructions couldn't get an invented priority through `completeStructured()`'s
Zod validation, since `coachLanguageSchema.parse()` silently strips any
extra key.

### Coach without AI

If no `AiProvider` is configured (the default, zero-config state) — or if
the provider throws, returns invalid JSON, or returns JSON that doesn't
match the schema — `generateCoachLanguage()` falls back to a deterministic
template (`deterministicFallback()`): a plain sentence naming the top
priority, plus one line per priority summarizing tier/title/reason. **The
Coach's core value — a small, evidence-linked, deterministic set of
priorities — never depends on AI configuration.** The AI only ever improves
how that same, already-decided answer is worded.

## Traceability

Every `CoachResponse` carries evidence tagged by kind — `your_data`,
`personal_pattern`, `general_knowledge`, `experimental_idea`,
`medical_followup` — rendered as visually distinct blocks in the UI, never
blended into one undifferentiated paragraph. `general_knowledge` notes come
from `lib/coach/knowledge-provider.ts`'s `HealthKnowledgeProvider` interface
— a small static curated note per intervention today, with the interface
deliberately left open for future sources (a user's NotebookLM export,
medical guideline references, research notes) without a vector database or
RAG this phase.

## Response contract

`CoachResponse` (`lib/coach/types.ts`): `summary`, `observations[]`,
`priorities[]` (each with `why`, `linkedGoalIds`, `linkedInsightIds`,
`linkedMetricKeys`, `confidence`, `burden`, `cautions`), `evidence[]`,
`uncertainties[]`, `safety`, an optional `suggestedExperiment`, and
`suggestedFollowUpQuestions[]`. `uncertainties` always includes the
disclaimer that the score is not medical probability, plus one line per
priority whose evidence is emerging/personal-experiment/unknown-level.

## Experiment bridge

When the top priority's evidence is weak (`EMERGING`/`PERSONAL_EXPERIMENT`/
`UNKNOWN`, or a `low`-confidence personal pattern), `askCoach()` sets
`suggestedExperiment` and the UI offers "Test this instead of assuming"
rather than stating it as settled. "Test this" on any priority opens the
existing `NewExperimentDialog` (the same Insight → Experiment bridge from
Phase 4) prefilled but unsaved — the user must still confirm before an
experiment is created.

## User acceptance and persistence

A `CoachPriority` row is **only ever created by `acceptPriority()`**, called
from the "Add to this week" button — never automatically, never on every
chat turn. Re-accepting an intervention that's already accepted/active
returns the existing row rather than duplicating it. `dismissPriority()`
marks it `DISMISSED` with an `endedAt` timestamp; dismissed priorities never
reappear in `getCurrentFocus()` or `listActivePriorities()`. Health truth
continues to live in Profile/Journal/Labs/Wearables/Goals/Experiments/
Insights, exactly as before — `CoachPriority` and conversation state are the
only new things Phase 6 persists, and conversation itself is **not**
persisted at all (see below).

### Coach memory

There is no chat-history table. Each browser session's conversation lives
only in React state (`app/coach/page.tsx`) and is gone on refresh — this was
a deliberate choice, not an oversight: "health truth" living anywhere but
the existing structured models (per the spec's own instruction) meant
conversation history had no clear home and no clear use once a priority was
either accepted (→ `CoachPriority`) or not. If a future phase finds a real
need for it, the persisted, structured `CoachPriority` rows are the record
of what mattered from a conversation, not the conversation transcript
itself.

## Data minimization

`lib/coach/data-minimization.ts`'s `buildMinimizedPayload()` is the only
thing that ever reaches an external AI provider, and it excludes, by
construction:

- **Raw journal text** — only per-category counts (`{nutrition: 2, mood: 1}`) survive.
- **Full goal objects** — only titles.
- **Full insight objects** — only titles + confidence level.
- **Medication/supplement details** — only names, and only when the safety
  classification is `PERSONAL_HEALTH_CONTEXT` or higher (a purely
  `GENERAL_WELLNESS` question never includes them at all).
- Everything else not already surfaced in the top 3 priorities.

This is tested directly (`tests/coach-data-minimization.test.ts`) — a
journal observation's actual text is asserted to never appear in the
serialized payload.

## Privacy boundary

```
LOCAL (never leaves the machine):
  safety classification, context building, candidate generation,
  prioritization/scoring, conflict detection, all persistence

EXTERNAL AI (only when AI_PROVIDER is configured, only for phrasing):
  the minimized payload above — question, safety classification,
  goal/pattern titles, journal category counts, the 3 decided priorities,
  and (conditionally) medication/supplement names
```

No wearable export file, no raw journal text, no full medical history, and
no unrelated historical data is ever sent. Every field that does get sent is
already a small, already-decided summary — never a query the model could use
to go fetch more.

## Known limitations

- Goal-alignment linking can attach a candidate to several goals at once
  (e.g. an alcohol-reduction candidate matching Sleep, Cardiovascular, and
  Longevity simultaneously) — correct, but the UI currently renders each
  linked goal as an undifferentiated "View goal" link rather than naming
  which goal each link is.
- The caloric-deficit conflict from the original spec is not implemented —
  no signal for it exists in the data model yet (see "Conflicts" above).
- `HealthMode` has no management UI this phase; modes are seeded/edited
  directly.
- Intent classification is regex-based and will miss phrasings it wasn't
  written for — it fails toward `general` (a safe, non-committal default),
  not toward a wrong specific intent.
- `IMMUNE`-category goals have no matching intervention in the current
  17-entry catalog — a real (if narrow) gap in the static content, not a
  logic bug.
- The confidence/burden/score fields shown for an *already-accepted*
  priority are frozen at acceptance time (stored in `CoachPriority.metadata`)
  and don't recompute as underlying data changes — re-running the Coach
  produces fresh suggestions, but an accepted priority doesn't silently
  re-score itself.
