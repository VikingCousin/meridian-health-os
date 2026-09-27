# Wearable ingestion architecture

Phase 5 replaced the mock wearable dashboard with a real, file-import-based
ingestion pipeline for Amazfit/Zepp data (and a generic-CSV fallback for
anything else). This document describes exactly what that pipeline does,
what it doesn't, and — per this phase's explicit honesty requirement — what
is architecture-only versus fixture-tested versus validated against a real
export.

## Why file import, not a live API

Before writing any code, this phase investigated the realistic options for
getting Amazfit Helio Strap / Zepp data into Meridian:

| Option | Verdict |
|---|---|
| **A. Zepp/Amazfit official data export** ("Request my data" in the Zepp app, Settings → Privacy) | **Selected.** A GDPR-style self-service export the user explicitly requests and downloads — no credentials stored, no reverse-engineered API, fully user-controlled. |
| B. Downloadable account archive | Same mechanism as A in practice. |
| C. CSV/JSON export | This is the *shape* the export in A/B typically takes — handled by the same importer. |
| D. Apple Health bridge | Plausible future option (Zepp can write some metrics to Apple Health on iOS if the user enables it; Meridian could then read an iOS Health "Export All Health Data" `export.xml`). Not built this phase — see "Future live sync" below. |
| E. Android Health Connect bridge | Similarly plausible, not verified for the current Zepp app version, not built this phase. |
| F. Officially documented public API | **No stable, generally-available consumer API for third-party Zepp/Amazfit integration was found.** Zepp has enterprise/B2B integration options in some contexts, but nothing equivalent to Fitbit's, Oura's, or WHOOP's public OAuth developer API for an individual user's own device. |
| G. Reverse-engineered private API | **Explicitly rejected**, per this phase's instructions, regardless of whether a working community client exists — an unofficial, undocumented API can change or break without notice and isn't a foundation to build on. |

**Conclusion:** there is no stable official direct API to integrate against
today. The correct architecture is import-based: the user exports their own
data through Zepp's own privacy tooling, and Meridian parses that file
entirely locally. This is also the most private option available — no new
account, no OAuth grant, no ongoing API access to revoke later.

## Architecture

```
External wearable source (Zepp export file / generic CSV)
        ↓
Connector / Importer          lib/wearables/importers/*.ts
        ↓  (parse: deterministic, no LLM)
Canonical records              CanonicalMeasurement / CanonicalSleepSession / CanonicalWorkoutSession
        ↓  (dedup + persist)
lib/wearables/services/wearable-import.service.ts
        ↓
BiomarkerMeasurement / SleepSession / WorkoutSession   (Prisma models)
        ↓
Phase 4 analytics (lib/analytics/*) — UNCHANGED, no provider-specific code
        ↓
Insights / Body / Home / Experiments
```

Amazfit/Zepp is a *source*, not the internal data model. Everything below
`WearableConnector.parse()` only ever deals in canonical metric keys, canonical
units, and plain Prisma rows — a future Apple Health, Health Connect, Garmin,
Oura, WHOOP, Polar, or hand-edited-CSV connector plugs into the exact same
`WearableConnector` interface (`lib/wearables/types.ts`) and needs zero
changes anywhere downstream, including zero changes to `lib/analytics/*`.

### Connector interface (`lib/wearables/types.ts`)

```ts
interface WearableConnector {
  sourceType: "ZEPP" | "GENERIC_CSV";
  detect(files: WearableInputFile[]): boolean;   // cheap structural check
  parse(files: WearableInputFile[]): ParsedWearableData; // full deterministic parse
}
```

`lib/wearables/registry.ts` tries the more specific Zepp connector first,
then falls back to generic CSV, then reports "unsupported export format" —
never guesses.

### Layer separation

- **Parsing** (`lib/wearables/importers/*`) — turns file bytes/text into
  `CanonicalMeasurement[]` / `CanonicalSleepSession[]` / `CanonicalWorkoutSession[]`.
  Never touches Prisma.
- **Normalization** (`lib/wearables/normalization/*`) — unit conversion
  (`unit-normalizer.ts`), timestamp parsing and sleep-day assignment
  (`timestamp-normalizer.ts`), and the canonical metric catalog + raw-field
  alias resolution (`metric-map.ts`). Pure functions, no I/O.
- **Persistence** (`lib/wearables/services/wearable-import.service.ts`) —
  the only place that deduplicates, enforces demo/real isolation, and
  writes to the database.

## Supported file formats

- **Zepp export** (`ZeppWearableImporter`): a `.zip` (or already-extracted
  `.csv` files) containing per-metric CSVs, matched by filename substring
  (`SLEEP`, `SPORT`/`WORKOUT`/`EXERCISE`, or `HEARTRATE`/`SPO2`/`ACTIVITY`/`STRESS`/`PAI`
  for point metrics). Point-metric files reuse the exact same header-alias
  matching as the generic CSV importer; sleep and workout files get
  dedicated multi-column reconstruction (see below).
- **Generic CSV** (`GenericCsvImporter`): any `.csv` with a detectable
  date/time column, one row per timestamp. Column-to-metric mapping is
  auto-suggested from header names (`autoDetectMapping()`) — e.g. "Resting
  HR" → `resting_hr`, "Sleep HRV" → `hrv` — via the same alias table the
  Zepp importer uses. **A manual column-remapping UI (dragging a column onto
  a different metric, or specifying a unit override) was not built this
  phase** — only auto-detection. A column with no recognized header alias is
  reported as an unknown field and skipped, never guessed.

### ⚠️ Zepp format validation status

This is the honesty-critical part. **The Zepp importer's column-alias
assumptions are based on the generally-documented shape of a Mi Fit/Zepp
"request my data" export (one CSV per metric family), not on a real export
file from this user's account.** Concretely:

- **ARCHITECTURE IMPLEMENTED:** the connector interface, zip extraction and
  security handling, filename classification, sleep/workout reconstruction,
  and canonical metric mapping are all real, working code.
- **PARSER TESTED AGAINST SYNTHETIC FIXTURES:** `tests/fixtures/wearables/`
  contains hand-built CSVs modeled on the commonly-documented Zepp export
  shape (`tests/wearables-importers.test.ts`, `tests/wearables-import-service.test.ts`).
  These tests pass and prove the code behaves correctly *given that
  assumed shape*.
- **NOT YET DONE: REAL HELIO EXPORT VALIDATION.** No real Zepp/Amazfit
  export file has been used to verify these column-name assumptions. Zepp
  has changed its export's exact column names across app versions, and this
  implementation has not been checked against the current one. Because
  unrecognized columns are reported as "unknown fields" rather than
  misparsed, a real export with different column names should *fail safely*
  (import fewer/zero records with clear warnings) rather than silently
  import wrong values — but this has not been confirmed with a real file.

**To get real validation:** export your data from the Zepp app (Profile →
Settings → Privacy → "Request my data" or similar wording depending on app
version), download the resulting archive to your phone or Mac, and use
"Import data" → "Amazfit / Zepp export" on the Profile → Data sources page.
The import wizard's review step will show exactly what it recognized versus
what it didn't — that's the fastest way to see whether the current column
assumptions hold for a real file, without sending it anywhere.

## Canonical metric catalog

Every metric the importer can write is a `BiomarkerDefinition` (see
`lib/domain/biomarker-catalog.ts`) with a matching entry in
`lib/wearables/normalization/metric-map.ts`:

**Sleep:** `sleep_duration`, `sleep_score`, `deep_sleep`, `rem_sleep`,
`light_sleep`, `awake_duration`, `sleep_efficiency`, `sleep_latency`
**Recovery/cardiovascular:** `hrv`, `resting_hr`, `average_sleeping_heart_rate`,
`heart_rate`, `respiratory_rate`
**Oxygen:** `spo2`
**Activity:** `steps`, `active_minutes`, `distance`, `calories_active`
**Training:** `training_load`, `vo2max`
**Stress:** `stress_level`

Nothing outside this list is invented — a source field that doesn't map to
one of these is reported as an unknown field, never coerced into an
approximate bucket. `sleep_start`/`sleep_end`/`workout_type` etc. are
structural fields of `SleepSession`/`WorkoutSession`, not point metrics, so
they aren't in this list.

## Units

Each catalog entry owns its own canonical unit and conversion function
(`lib/wearables/normalization/unit-normalizer.ts`): duration → minutes,
heart rate → bpm, HRV → ms, percentages → 0–100 (a 0–1 fraction is also
accepted and rescaled), distance → km, weight → kg, temperature → °C. An
unrecognized or missing unit returns `null` — the record is then skipped
with an `AMBIGUOUS_UNIT` warning rather than assumed.

**Deliberate exception — sleep duration stays in hours, not minutes.**
Meridian's pre-existing seed data, UI formatting (`formatGroupValue()` on the
insight detail page, `formatHoursMinutes()` on Home), and Phase 4 analytics
all predate this phase and already treat `sleep_duration` as hours. Changing
that convention now would touch multiple already-tested call sites for a
purely cosmetic unit preference, so `sleep_duration` specifically converts to
hours (`normalizeSleepDurationHours()` in `metric-map.ts`), documented there
inline. Every other duration metric (deep/REM/light sleep, active minutes,
workout duration) uses minutes as specified.

**A consequence worth knowing:** a plain generic-CSV column like "Sleep
Duration" with bare numeric values and no unit annotation is genuinely
ambiguous (7.1 could mean 7.1 hours or 7.1 minutes) and is skipped with a
warning, since there's no per-column manual unit override UI yet (see
above). HRV/heart-rate/percentage-style columns don't have this problem —
their canonical unit is unambiguous enough that an empty/missing unit string
is accepted.

## Timezone and the "sleep day" convention

`lib/wearables/normalization/timestamp-normalizer.ts` parses ISO-8601 (with
or without an explicit offset), `YYYY-MM-DD[ HH:mm:ss]`, and raw epoch
seconds/milliseconds. When a value has no explicit offset, an optional
caller-supplied offset is applied; failing that, UTC is assumed and flagged
(`assumedUtc: true`) — never silently guessed as local time.

A sleep session is assigned to the calendar date of its **end time** (the
wake-up morning), evaluated in the session's own timezone offset when known:

```
sleep starts:  2026-09-06 23:18
sleep ends:    2026-09-07 06:42
sleep day:     2026-09-07
```

This matches the convention the rest of the app's wearable data already
uses (Phase 2–4's daily sleep_duration/sleep_score values are dated by the
wake-up morning). DST transitions are handled correctly by construction:
every internal `Date` represents an absolute UTC instant, so a transition in
the *local* calendar never shifts the underlying instant — only which
calendar day it's attributed to, which is exactly what the offset-aware
`resolveSleepDay()` computes.

## Deduplication

Every canonical record gets an `externalId`: the source's own native record
ID when the format provides one, otherwise a deterministic SHA-256
fingerprint (`lib/wearables/fingerprint.ts`) over the fields that define the
record (provider + metric + timestamp + value + unit for a measurement;
provider + start/end for a sleep or workout session). `BiomarkerMeasurement`,
`SleepSession`, and `WorkoutSession` each have a `@@unique([dataSourceId, externalId])`
constraint, and the import service upserts against it — re-importing the
identical file produces the same fingerprints, which the unique constraint
recognizes as already present. A repeat import of the same file reports
`recordsImported: 0` / `recordsSkipped: <n>` and is treated as a successful
no-op (`status: "COMPLETED"`), not a partial failure.

## Demo vs. real data isolation

Demo-seeded wearable rows (`prisma/seed.ts`) are `sourceType: WEARABLE` with
no `dataSourceId`. Real imports always set `dataSourceId`. The import
service uses exactly this distinction: the first time a real measurement
lands for a given canonical metric, it deletes any existing demo rows for
that same metric (`dataSourceId IS NULL`) before inserting — see
`deleteDemoMeasurementsForDefinition()` in
`lib/db/repositories/wearable.repository.ts`. This check is cheap and
idempotent (a no-op once no demo rows remain), so it runs unconditionally on
every import rather than needing separate state to track "have we already
cleared demo data for this metric." **Demo and real data are never
numerically blended** — analytics always see either the seeded Alex
dataset or real imported data for a given metric, never both mixed
together. Unaffected metrics (ones the user hasn't imported yet) keep their
demo values until a real import for that specific metric arrives.

## Destructive reset safety

Two commands can wipe the whole database: `npm run db:seed` (plain row
deletes) and `npm run db:reset` (`prisma migrate reset --force`, which drops
and recreates the schema before `seed.ts`'s own `seed` hook ever runs — too
late for that script's own guard to help). Both are now guarded:

- `prisma/seed.ts` refuses to run (`guardAgainstRealData()`) if any
  `HealthDataSource` has a successful import, unless
  `ALLOW_DESTRUCTIVE_RESET=1` is set.
- `npm run db:reset` first runs `scripts/check-safe-to-reset.ts`, which
  performs the same check *before* invoking `prisma migrate reset --force`
  — the only point at which it's still possible to stop the drop.
- `npm run demo:reset` is the explicit, documented override:
  `ALLOW_DESTRUCTIVE_RESET=1 npm run db:reset`. Use this, not raw
  `db:reset`, once you've imported real data and genuinely want to wipe
  everything back to the demo dataset.

## Backup

`npm run db:backup` copies `data/app.db` to a timestamped file under
`data/backups/` (gitignored) and never overwrites a previous backup. To
restore: stop the dev server, then copy a backup file back over
`data/app.db` (the command prints the exact `cp` command to run). Uploaded
lab documents live separately under `data/uploads/` and aren't included in
this backup — copy that directory too for a complete backup. No cloud
backup is implemented.

## Provenance

Every imported measurement carries its source through to the UI without any
new provenance UI needing to be built: `BiomarkerMeasurement.dataSourceId`
is now included wherever a measurement is read
(`lib/db/repositories/biomarker.repository.ts`), and
`lib/services/biomarker.service.ts`'s existing source-label resolution
prefers `dataSource.displayName` ("Amazfit Helio Strap") the same way it
already preferred a lab document's provider name — the existing
`SourceBadge`/`Biomarker.source` UI just started rendering real values.
Subjective journal data, measured wearable data, and lab data remain
visually distinct exactly as before.

## Privacy and security

- **Privacy:** every import is parsed entirely in this Node process, in
  memory. No wearable export — zip, CSV, or JSON — is ever sent to
  Anthropic or OpenAI, regardless of `AI_PROVIDER` configuration; nothing in
  `lib/wearables/*` imports `lib/ai/*` or either extraction module. This was
  also verified live: importing a file and inspecting network traffic
  showed zero requests to any AI provider.
- **No AI parsing of structured exports (hard rule):** every parsing step
  is deterministic TypeScript. An unrecognized file format shows
  "Unsupported export format" — it is never handed to an LLM to guess at.
- **Untrusted-file handling:** zip archives are treated as untrusted input
  (`lib/wearables/importers/zip-utils.ts`). Every entry path is checked
  against path traversal ("zip-slip") and absolute paths before extraction;
  only `.csv`/`.json`/`.txt` extensions are extracted (everything else is
  ignored, not executed or written anywhere); entry count and total/
  per-file uncompressed size are capped; extraction happens entirely in
  memory (via `jszip`), so there is no temporary file on disk to clean up
  afterward.

## Future live sync (not implemented)

```
CURRENT:  manual export → Meridian import wizard → canonical records
FUTURE:   official API / Apple Health bridge / Health Connect bridge → the SAME canonical ingestion layer
```

If Zepp or Amazfit ever ships a stable, documented consumer API, or if
reading an iOS "Export All Health Data" `export.xml` / Android Health
Connect proves reliable, either would plug in as one more
`WearableConnector` implementation — the canonical-record layer, dedup
strategy, and everything from `wearable-import.service.ts` downward needs no
changes. None of this is implemented yet; only the architecture is shaped to
make it a contained addition later.

## What was not built this phase

- Manual per-column unit/mapping override UI for generic CSV (auto-detection only).
- A dedicated `/sleep` detail view and a `/data/wearables` technical explorer
  (both explicitly marked "create or improve" / secondary in scope — the
  core ingestion pipeline, Data Sources UI, and import wizard were
  prioritized instead).
- Apple Health / Health Connect / any live-sync bridge.
- Import-session detail drill-down as its own route (the history list shows
  counts and status inline instead).
