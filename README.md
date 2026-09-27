# Meridian — Personal Health OS (prototype)

A local-first personal health dashboard: one place to see your body's
systems, track biomarkers from lab reports, log a journal, follow
deterministic experiments and goals, and get a transparent, rule-based
recommendation on what to focus on next — all stored only on your own
machine.

This is a personal, AI-assisted software project (built with Claude Code),
not a professional or commercial product. It is **not medical advice, not a
medical device, and not a substitute for professional healthcare** — see
the disclaimer at the end.

## Why this exists

Most personal health tracking is scattered across a wearable's app, a lab
portal, a notes app, and memory. This project explores what a single,
private, local dashboard could look like instead: your biomarkers, wearable
data, and journal in one place, with a coach that explains *why* something
matters rather than a black box that just tells you what to do — and with
every "insight" traceable back to the actual data point that produced it.

## Key features

- **Body Explorer** — an interactive visual map of the body's systems
  (cardiovascular, metabolic, hormonal, etc.), each linking to the relevant
  biomarkers, journal entries, and knowledge articles.
- **Lab report import** — upload a PDF/image of a lab report; values are
  extracted and shown for review before anything is saved. Works with a
  deterministic mock extractor by default, or real AI extraction
  (Anthropic/OpenAI) if you opt in — see [Privacy & AI](#privacy--ai) below.
- **Journal** — free-text entries, with the same optional AI-assisted
  extraction turning them into structured, queryable health events.
- **Wearable import** — a local file-import pipeline for Amazfit/Zepp
  exports (plus a generic-CSV fallback), with deduplication and import
  history. No live device API integration.
- **Insights** — a deterministic pattern engine (baselines, trends, and
  matched-control exposure/outcome associations), computed entirely in
  application code, with confidence levels and a traceable "why am I seeing
  this" for every insight. No LLM is involved in deciding what counts as an
  insight.
- **Coach** — a rule-based orchestration pipeline decides what to prioritize
  (a transparent 0–100 score, capped at 3 priorities, safety-classified
  first); an LLM is used only to phrase the already-decided answer in
  natural language, never to decide it.
- **Knowledge layer** — a small, self-contained library of health articles
  with lexical search and real citations surfaced on relevant Body and
  biomarker pages.
- **Goals & Experiments** — long-term goals and personal single-variable
  experiments (e.g. "avoid late meals"), tracked over time.
- **Privacy dashboard** — an in-app page showing exactly what data exists,
  where it's stored, and what (if anything) ever leaves your machine, plus
  a one-click local backup/export.

## What it deliberately does not do

No cloud account, no server-side database, no telemetry. No LLM makes a
medical decision or generates a biomarker value — extraction and analytics
are deterministic; the LLM (when enabled) only explains a result that
already exists. No data is sent anywhere unless you explicitly opt into a
real AI provider for extraction, and even then only the document/text being
extracted is sent, never your full history.

## Architecture

```
app/                Next.js App Router routes + Server Actions
components/         UI, organized by domain (body, health, journal, profile, coach)
lib/
  db/               Prisma client + repositories (the only files that touch Prisma models directly)
  services/         Business logic, mapping DB rows to UI types
  ai/               Provider-agnostic LLM abstraction (Anthropic / OpenAI), only called if enabled
  extraction/       Lab-document extraction: deterministic mock + optional AI implementation
  journal-extraction/  Same pattern for journal entries
  analytics/        Deterministic baseline/trend/association/confidence engine
  coach/            Context building, candidate generation, prioritization, safety, language
  knowledge/        Markdown import, content hashing, lexical search
  wearables/        Import connectors, normalization, dedup
  domain/           Static domain data (e.g. the biomarker catalog)
prisma/             Schema, migrations, and a fictional-persona seed script
docs/               Architecture write-ups per subsystem (see below)
tests/              276 Vitest tests, including synthetic fixtures for extraction and wearable import
```

Data flow: everything is read from and written to a local SQLite database
and a local uploads folder — there is no backend service beyond the Next.js
app itself, and no data leaves the machine except an optional, explicit
call to an AI provider for document/journal extraction.

## Tech stack

- Next.js 16 (App Router, Server Components + Server Actions), React 19, TypeScript
- Tailwind CSS v4, Recharts
- Prisma 7 + SQLite
- Zod for input validation
- Vitest (276 tests)
- `@anthropic-ai/sdk` / `openai` — only invoked if you opt in

## Privacy & AI

Everything works with **zero external calls** by default: lab extraction
and journal extraction use deterministic, local logic unless you set
`AI_PROVIDER` in `.env`. If you do enable it, the app sends only the
document being processed (its bytes, or the journal text) to that
provider's API for that one extraction — never your full profile, history,
or biomarker database. An in-app "External AI: On/Off" toggle lets you turn
this off at any time without losing any other feature. See
[`docs/PRIVACY_ARCHITECTURE.md`](docs/PRIVACY_ARCHITECTURE.md) for the full
design, including what is and isn't stored, and
[`docs/DATA_PORTABILITY.md`](docs/DATA_PORTABILITY.md) for backup/export.

**No authentication.** This is a single-user, local-first app with no login
screen — anyone with access to the machine (or, if you expose it on your
home network, anyone on that network) can open it. This is a deliberate
scope decision for a personal project, not an oversight; it would not be
appropriate for a shared or public deployment.

## Demo data

The repository ships with **no real health data**. `npm run db:seed`
creates a fictional persona ("Alex") with invented biomarkers, goals, and
journal entries, purely to make every screen explorable. Wearable-import
tests use synthetic CSV fixtures under `tests/fixtures/`, not a real
export. Once you enter your own data, the app switches to "real-user mode"
(see `docs/DATA_MODEL.md`) and destructive commands like `db:seed`/
`db:reset` refuse to run to protect it.

## Setup

```bash
npm install
cp .env.example .env      # only fill in AI_PROVIDER + an API key if you want real AI extraction
npm run db:migrate        # creates data/app.db and applies migrations
npm run db:seed           # populates it with the fictional "Alex" demo data
npm run dev
```

Then open http://localhost:3000. Nothing here requires any file outside
this repository — a fresh clone works end-to-end with synthetic demo data.

## Testing

```bash
npm test    # 276 Vitest tests, against a separate data/test.db
npm run lint
```

## Project status

Personal project, actively evolving, currently used by its author with
real data (never committed — see `.gitignore`). Not deployed anywhere
public. Several subsystems are explicit about validation status in their
own docs rather than claiming more than has been verified — for example,
the wearable importer's column-mapping assumptions are documented as
"based on the generally-known export shape" versus "confirmed against a
real export file" in `docs/WEARABLE_ARCHITECTURE.md`. See the end of
`docs/DATA_MODEL.md` for the current list of what's still illustrative-only
(parts of the wearable dashboard, some Coach responses, some timeline event
types).

## Docs

- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — schema and architecture rationale
- [`docs/PRIVACY_ARCHITECTURE.md`](docs/PRIVACY_ARCHITECTURE.md) — how personal data is stored and kept local
- [`docs/ANALYTICS_ARCHITECTURE.md`](docs/ANALYTICS_ARCHITECTURE.md) — the deterministic pattern engine
- [`docs/WEARABLE_ARCHITECTURE.md`](docs/WEARABLE_ARCHITECTURE.md) — import connectors and validation status
- [`docs/COACH_ARCHITECTURE.md`](docs/COACH_ARCHITECTURE.md) — context building, prioritization, safety
- [`docs/KNOWLEDGE_ARCHITECTURE.md`](docs/KNOWLEDGE_ARCHITECTURE.md) — knowledge import and search
- [`docs/DATA_PORTABILITY.md`](docs/DATA_PORTABILITY.md) — backup, restore, export

## Disclaimer

Meridian is a personal software prototype built as a learning/portfolio
project. It is **not medical advice, not a medical device, and not a
substitute for professional healthcare**. It does not diagnose anything,
and any "insight" it surfaces is a statistical association in your own
data, not a clinical conclusion. Always consult a qualified healthcare
professional for medical decisions.
