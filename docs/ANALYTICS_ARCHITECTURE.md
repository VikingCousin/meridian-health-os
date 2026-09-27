# Analytics architecture — the Personal Pattern Engine

This document describes Meridian's first real health-intelligence layer:
deterministic, application-code statistics that look for patterns in one
person's own longitudinal data. It is **not a diagnostic engine**. It does
not calculate scientific or clinical confidence, and no LLM is involved in
deciding whether a pattern exists.

## Layers

Data flows through five distinct layers, and each stays a distinct,
inspectable artifact — nothing collapses two of these into one AI-generated
object:

```
RAW DATA               JournalObservation, BiomarkerMeasurement rows
      ↓
NORMALIZED EVENTS       NormalizedHealthEvent (lib/health-events/normalization.service.ts)
      ↓
DERIVED METRICS         Baseline (lib/analytics/baseline.service.ts)
                        Trend (lib/analytics/trend.service.ts)
      ↓
PATTERN CANDIDATES      Association (lib/analytics/association.service.ts),
                        evaluated only for registered pairs (association-registry.ts)
      ↓
PERSISTED INSIGHTS      HealthInsight + InsightEvidence (lib/analytics/health-analysis.service.ts)
      ↓
OPTIONAL EXPLANATION    Not implemented yet — see "No LLM analytics" below.
```

Worked example: a journal entry says "ate a late dinner, woke up several
times." The `JournalObservation` row (`FOOD`/"Late meal") is deterministically
mapped to a `NormalizedHealthEvent` of type `LATE_MEAL`. The association
engine looks up the registered candidate `LATE_MEAL → sleep_duration /
NEXT_NIGHT`, computes an exposure-vs-control comparison, and — if there's
enough data — creates or updates a `HealthInsight` row with the evidence
attached. No step is skipped, and every number in the final insight can be
traced back through this chain to the original journal entry or wearable
measurement.

## Personal Baseline Engine (`lib/analytics/baseline.service.ts`)

For a rolling window (7/14/30/90 days) ending at a reference date, computes
`count`, `mean`, `median`, `min`, `max`, `stdDev`, `p25`, `p75`, and the
percent change against the immediately preceding window of the same length.

Below `MIN_BASELINE_COUNT` (3) points in the window, the result is
`{status: "INSUFFICIENT_DATA", requiredCount: 3}` — the function never
fabricates a baseline from too little data. Percentiles use linear
interpolation; standard deviation is the sample (n-1) formula.

## Trend Engine (`lib/analytics/trend.service.ts`)

Classifies a metric's full series as `INCREASING`, `DECREASING`, `STABLE`, or
`INSUFFICIENT_DATA` (below `MIN_TREND_SAMPLES` = 5 samples or
`MIN_TREND_SPAN_DAYS` = 6 days of span). The method is ordinary least-squares
linear regression of value against elapsed days; the fitted slope's implied
change over the observed span, relative to the series' own mean, is compared
against `TREND_NOISE_THRESHOLD_PCT` (3%) to decide `STABLE` vs a direction.

**The trend engine makes no judgment about whether a direction is good.**
`computeTrend()` returns the same neutral shape (`direction`, `slopePerDay`,
`rSquared`, `relativeChangePct`, ...) whether the metric is creatinine
(where a decrease is typically reassuring) or VO2max (where a decrease is
typically a concern) — that interpretation is a UI/caller-level concern,
never baked into the engine.

## Normalized Health Events

`NormalizedHealthEvent` (see `prisma/schema.prisma`) is a small, deliberately
bounded taxonomy (`LATE_MEAL`, `ALCOHOL`, `SAUNA`, `HIGH_INTENSITY`, ...) that
sits between raw journal/biomarker data and the analytics layer.
`JournalObservation` rows are never mutated or replaced — normalization only
*adds* a new, separately-queryable row referencing the original observation
by id (`sourceType: "JOURNAL_OBSERVATION"`, `sourceId`).

`lib/health-events/normalization.service.ts` maps observations to event
types via an explicit `(ObservationType, text pattern) → NormalizedEventType`
rule table — not a second LLM call. If no rule matches, the observation is
left un-normalized rather than guessed into an event: *"it is better to miss
an event than create a false one."* The mapping is idempotent — re-running it
upserts on the `(sourceType, sourceId, type)` unique constraint, so a
corrected observation updates its event instead of duplicating it.

## Association Registry (`lib/analytics/association-registry.ts`)

An explicit, hand-authored list of `{exposureType, outcomeMetricKey, lag}`
candidates — not every event type tested against every metric. Untargeted
combinatorial testing would be data-mining bias dressed up as
personalization, so a relationship is only ever evaluated if someone put it
in this file on purpose.

### Lag resolution (`lib/analytics/lag.ts`)

Only five lag labels are supported: `SAME_DAY`, `SAME_NIGHT`,
`NEXT_MORNING`, `NEXT_NIGHT`, `NEXT_DAY`, `NEXT_24H`, `NEXT_48H` (seven
distinct labels; several intentionally resolve to the same offset — see
below). There is no dynamic search across arbitrary lag windows.

This dataset's wearable measurements are one value per calendar day, dated
by the morning they were recorded (i.e. "last night's sleep" is stored under
the wake-up date). At that granularity, `SAME_NIGHT`, `NEXT_MORNING`,
`NEXT_NIGHT`, `NEXT_DAY`, and `NEXT_24H` are all satisfied by "the
measurement dated one calendar day after the exposure" — there is no
finer-grained timestamp available to distinguish them further. This is a
deliberate, documented simplification, not an inconsistency: only
`SAME_DAY` (offset 0) and `NEXT_48H` (offset 2) resolve differently. A future
phase with intraday wearable timestamps could resolve these more precisely
without changing the registry's shape.

## Association service (`lib/analytics/association.service.ts`)

For a candidate, pairs each exposure occurrence with the outcome metric's
value at `exposureDate + lagOffset`. Occasions without a matching outcome
measurement are dropped (`missing outcome data` is handled by simply not
counting that occasion, not by inventing a value, and is reported explicitly
via `quality.missingOutcomeCount`). The remaining pairs form the **exposure
group** (`exposureGroup`); two separate control comparisons are computed
against it — see below — each reporting `n`, `mean`, `median`, `stdDev`.

### Local vs. global control (Phase 4.1)

Comparing an exposure only against "every other day, however long ago" risks
picking up long-term drift rather than the exposure's own association. Every
candidate now computes **two** control groups:

- **`globalControl`** — every day in the outcome series that isn't an
  occurrence (or lag-mapped outcome day) of this same exposure type. Kept
  for reference and as the documented fallback.
- **`localControl`** — for each exposure occasion, a ±`LOCAL_WINDOW_DAYS`
  (14) window of non-exposure days around it, pooled and **deduplicated by
  calendar date** across occasions (a day within range of several occasions
  contributes its value once, not once per occasion — otherwise clustered
  exposures would over-weight the days near them). Within that pool, days
  are preferentially matched by day-context (`WEEKDAY` vs. `WEEKEND`, via
  `classifyDayContext()` in `lib/analytics/stats.ts`) when at least
  `MIN_LOCAL_CONTROL` (5) such matched days exist
  (`matchingStrategy: "DAY_CONTEXT_LOCAL"`); otherwise the full local window
  is used if it alone clears that threshold
  (`"LOCAL_WINDOW"`); otherwise `localControl.status` is
  `"LIMITED_CONTROL_DATA"` (`matchingStrategy: "INSUFFICIENT"`) and the
  **primary comparison explicitly falls back to `globalControl`** —
  `AssociationResult.primaryControlSource` records which one was actually
  used, so this is never a silent substitution.

Both exclusion rules apply to both control groups: every raw exposure date
*and* its lag-mapped outcome-equivalent date are excluded from candidacy —
not just the paired outcome days — so a different occasion's window can
never count an exposure day (or its outcome day) as if it were unexposed.

### Effect size (Phase 4.1: proper pooled SD)

`effect.standardizedDifference` is **Cohen's d** — the standardized mean
difference using the two-sample pooled standard deviation (`pooledStdDev()`
in `lib/analytics/stats.ts`: `sqrt(((n1-1)·var1 + (n2-1)·var2)/(n1+n2-2))`),
against whichever control (`localControl` or `globalControl`) is primary.
This replaced an earlier, weaker version that divided only by the control
group's own spread — that formula is no longer used anywhere and is not
called "Cohen's d" in the codebase before this change, since it didn't match
the standard definition. `effect.meanDifference` and `effect.medianDifference`
are both computed and shown — median is the more robust figure for noisy
health metrics, so the UI's detail view shows both rather than only the mean.
`standardizedDifference` is `null` (never `NaN`/`Infinity`) whenever a mean is
undefined or the pooled SD is zero.

### Outlier diagnostics (transparency only)

`quality.outlierCountExposure` / `outlierCountControl` use a Tukey-fence IQR
rule (`iqrOutlierCount()`): values outside `[Q1 − 1.5·IQR, Q3 + 1.5·IQR]`,
requiring at least 4 points to define quartiles meaningfully. **Outliers are
never excluded** — they remain in every group's `n`/`mean`/`median`/`stdDev`;
the count is surfaced purely as a data-quality signal.

### Temporal drift

`quality.temporalDriftDetected` reuses the existing Trend Engine
(`computeTrend()` on the full outcome series, not a new regression
implementation) and flags `true` when the series shows a non-`STABLE`
direction with `|relativeChangePct| ≥ TEMPORAL_DRIFT_THRESHOLD_PCT` (15%).
This is a **documented penalty trigger, not a correction** — the association
math itself is unchanged; drift only lowers confidence (see below) and adds
a cautious-language caveat.

### Supporting vs. contradicting

The aggregate direction (`effect.meanDifference` sign, relative to the
primary control) defines what "supporting" means for this candidate; each
individual occasion is then classified against the primary control's mean.
Both counts are always computed and persisted — an insight with supporting
evidence and zero contradicting evidence is a plausible but not guaranteed
outcome, never an assumption baked into the code.

### Confounding breakdown

`quality.confounding` reports a full per-type breakdown
(`coOccurringCounts: [{eventType, count}]`), not just an aggregate ratio —
e.g. `{ALCOHOL: 3, HIGH_STRESS: 2}` — alongside `overlapOccasions` /
`totalExposureOccasions`. This is basic co-occurrence awareness, not causal
adjustment — the UI shows the full breakdown under "Co-occurring recorded
factors" and states explicitly that it is not mathematically adjusted for.

### Source confidence

`quality.sourceConfidence` averages the originating `NormalizedHealthEvent`
confidence across the exposure occasions used (carried from
`JournalObservation.confidence`) and counts how many fall below
`LOW_SOURCE_CONFIDENCE_THRESHOLD` (0.6). This is an internal analysis weight
on the *exposure* side only — deliberately not a general "medical
reliability" hierarchy across every source type, which would be
over-engineering for what this phase needs. It exists so a pattern built
mostly from low-confidence AI-extracted journal text is flagged as such
rather than treated identically to one built from clearly-stated
observations.

### Minimum evidence

`MIN_GROUP_SIZE` (3) applies to both the exposure group and the global
control independently — below that, the result is `INSUFFICIENT_DATA` with
explicit `reasons`. `MIN_LOCAL_CONTROL` (5) is a separate, independent
threshold that only governs whether the *local* comparison is usable; an
association can still be `VALID` via the global-control fallback even when
local control is limited.

## Confidence Engine (`lib/analytics/confidence.service.ts`)

Produces a 0–100 **personal confidence** score plus a component breakdown:
`exposureCount`, `controlCount`, `consistency`, `effectSize`,
`dataCompleteness`, `contradictionPenalty`, `confoundingPenalty`, and, as of
Phase 4.1, `localControlPenalty` (−8 when the comparison fell back to global
control), `temporalDriftPenalty` (−8 when `quality.temporalDriftDetected`),
and `sourceConfidencePenalty` (up to −10, scaled by how far average source
confidence falls below the low-confidence threshold). Event count alone is
capped at a small share of the total (≤20 of 100) specifically so it cannot
dominate the score — with zero consistency and zero effect size, the maximum
reachable total from counts + data completeness is 50, well short of the 75
needed for `STRONG`; consistency and effect size (up to 40 combined) are
required to cross that threshold. This is verified directly by a test.

**This score is not a probability and not scientific, clinical, or medical
confidence.** Every result carries `CONFIDENCE_DISCLAIMER`
(`lib/analytics/confidence.service.ts`) verbatim, and the UI repeats it next
to every confidence breakdown shown to the user. Levels (`EARLY` <35,
`POSSIBLE` <55, `MODERATE` <75, `STRONG` ≥75) are informal, application-
specific bands — not calibrated to any external statistical standard. Every
weight and penalty above is a documented heuristic choice, not a
statistically derived or validated instrument.

## Data Quality Engine (`lib/analytics/data-quality.service.ts`)

Flags `GOOD` / `LIMITED` / `POOR` / `INSUFFICIENT` from thin exposure/control
groups, missing outcome data, large measurement gaps, and low-confidence
extracted observations, always with an explicit `reasons` array — never a
bare status with no explanation. Poor data quality directly lowers the
`dataCompleteness` component of the confidence score.

## Persisted insights (`HealthInsight`, `InsightEvidence`)

An insight is deduplicated by `fingerprint` (e.g.
`"association:LATE_MEAL:sleep_duration:NEXT_NIGHT"`). Re-running analysis
updates the matching row's confidence, evidence, and `lastObservedAt` instead
of creating a duplicate. **A dismissed insight (`status: "DISMISSED"`) is
never silently reactivated** — `health-analysis.service.ts` checks for this
explicitly and skips the candidate entirely on a rerun.

Every analytical claim traces to `InsightEvidence` rows
(`EXPOSURE`/`OUTCOME`→ stored jointly as `SUPPORTING`/`CONTRADICTING` per
occasion, plus `BASELINE` and `CONFOUNDING` rows, and — as of Phase 4.1 —
**two separate `CONTROL` rows**, one tagged `metadata.scope: "LOCAL"` and one
`"GLOBAL"`, so both control comparisons stay independently traceable), each
pointing at a `NormalizedHealthEvent` or biomarker metric key. This is what
the Insight Detail page's evidence lists and "why am I seeing this?" answer
are built from — nothing on that page is computed ad hoc at render time
beyond formatting.

## Language safety

Analytical summaries are generated by `lib/analytics/language.ts` using
fixed, cautious templates — e.g. *"Your recorded sleep duration has been
lower on occasions following late meals, measured the next night. This
association may be worth testing."* — never *"Late meals cause poor sleep."*
Every insight detail page footer repeats: **"Association observed — not
proof of causation."** This discipline lives in the service layer
(`associationSummary()`, `associationTitle()`), not only in UI copy, so a
future screen can't accidentally bypass it.

As of Phase 4.1, one additional cautious caveat sentence is appended (to the
persisted summary, and shown again as a banner on the detail page) whenever
a specific weakness applies — `associationCaveat()` in `lib/analytics/language.ts`,
checked in this priority order: weak local control ("An early association is
visible, but comparable control data is limited."), then temporal drift
("Your baseline changed during this period, so this comparison is less
certain."), then frequent confounders at ≥50% overlap ("Other recorded
factors often occurred at the same time.").

## No LLM analytics (hard rule)

No language model ever computes a mean, median, percentile, standard
deviation, regression slope, effect size, confidence score, or association
strength in this codebase. All of `lib/analytics/*` and
`lib/health-events/*` is plain, deterministic TypeScript with no network
calls. A future phase could hand a *finished* structured result to an AI
provider purely to phrase it in natural language — that explanation layer is
explicitly **not implemented** in Phase 4.

## Orchestration (`lib/analytics/health-analysis.service.ts`)

`analyzeHealthData()` runs the full pipeline: normalize pending observations,
evaluate every `ASSOCIATION_REGISTRY` candidate, compute data quality and
confidence, and create/update `HealthInsight` + `InsightEvidence` rows. It is
**manual-trigger only** — there is no cron/background job, and no page load
runs this. The Insights page's "Analyze my health data" button
(`lib/actions/insights.ts` → `runAnalysisAction`) is the only way it runs in
the app itself (it's also invoked once at the end of `prisma/seed.ts` so the
demo data ships with insights already generated). Reading pages (`/insights`,
Home, Body) only ever reads already-persisted `HealthInsight` rows, plus a
handful of cheap, non-persisted live trend calculations for the Trends
section — never the full association pipeline.

## Privacy boundary

Every calculation described above runs locally, in this Node process,
against `data/app.db`. No health history, journal text, or biomarker value is
sent to Anthropic, OpenAI, or any other network endpoint as part of
analytics. The only place personal health content leaves the machine at all
is the existing, separately opt-in AI extraction path
(`lib/extraction/`, `lib/journal-extraction/`) documented in
`docs/PRIVACY_ARCHITECTURE.md` — and even then, only the single document or
journal entry being extracted is sent, never the analytics layer's
longitudinal dataset.

## Known limitations

- **Correlation, not causation.** Every association result is a same-cohort
  before/after comparison on one person's own data, not a controlled trial.
  Confounding awareness here is co-occurrence counting, not adjustment —
  Phase 4 explicitly does not implement causal inference.
- **Small-sample statistics.** With single-digit-to-low-double-digit exposure
  counts, effect size and confidence estimates carry real uncertainty that a
  0–100 score can understate if read as more precise than it is.
- **Lag-offset granularity**, as above — same-day wearable data collapses
  several conceptually distinct lags into one offset.
- **Confidence score calibration is heuristic**, not statistically derived
  (e.g. via power analysis or bootstrapping) — it is a transparent, documented
  weighting, not a validated instrument.
- **Trend "noise threshold" (3%) and association minimum group size (3)**
  are fixed constants tuned for this dataset's scale; they are not
  automatically adapted per metric.
- **Local-control window size (±14 days) and minimum size (5) are fixed
  constants**, not adapted to how much history exists or how frequently the
  exposure occurs. A more frequent exposure type could reasonably use a
  narrower window; that tuning isn't automatic yet.
- **Day-context matching is binary (weekday/weekend) and Friday-inclusive by
  convention** — it doesn't account for holidays, travel, shift work, or
  other calendar irregularities that would make a "weekday" behave like a
  weekend for a given person.
- **Temporal drift detection flags a metric-wide trend, but doesn't segment
  it** — it can't currently distinguish "the metric drifted only during the
  exposure period" from "the metric drifted only during the control period,"
  which would matter more for how much the penalty should really be.
- **Overlapping local-control windows are deduplicated by date, not
  reweighted** — a control day that would have been "the closest match" for
  one occasion but also falls in another occasion's window is treated
  identically to a day that's only relevant to one occasion.
- **Source-confidence weighting only covers the exposure side** (journal
  observation confidence), not the outcome side — appropriate for this
  dataset (outcome metrics are uniformly wearable-sourced) but will need
  revisiting once outcome data itself carries mixed provenance.
- **Cohen's d assumes roughly equal population variances** between the two
  compared groups (the standard pooled-SD assumption) — this is not verified
  per-comparison, and very unequal variances would make the pooled estimate
  less representative of either group individually.

## What's still not built (by design, for this phase)

Amazfit/Apple Health/Google Health Connect integration, full Coach
orchestration, medical diagnosis or treatment logic, supplement/medication
recommendations, predictive disease models, genomic analysis, background job
infrastructure, and an AI explanation layer over finished analytics results
are all explicitly out of scope for Phase 4 — see the closing section of the
Phase 4 spec for the full exclusion list.
