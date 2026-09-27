# Privacy architecture

This app stores sensitive personal health information. Here's exactly where
it lives and what does (and doesn't) leave the machine it runs on.

## Local storage by default

- **Structured health data** (profile, medical history, medications,
  supplements, biomarker measurements, journal entries and their derived
  observations, goals, experiments) lives in one SQLite file:
  `data/app.db`. There is no remote database, no sync service, and no cloud
  backup wired up.
- **Uploaded documents** (lab report PDFs/images) are written as plain files
  under `data/uploads/`, named by a random UUID rather than anything
  derived from their content or the original filename. The database only
  ever stores that filename plus metadata (type, upload date, provider name)
  — see `lib/services/document.service.ts`. Binary file contents never pass
  through the database.
- Both `data/app.db` and `data/uploads/` are excluded from version control
  (`.gitignore`) so they can never end up committed or pushed anywhere.

## Network calls are opt-in, explicit, and off by default

- There is no analytics SDK, telemetry beacon, or third-party tracking
  script anywhere in the app (check `app/layout.tsx` and `package.json` —
  nothing resembling one is installed).
- **By default (no `AI_PROVIDER` set in `.env`), nothing leaves the machine.**
  Journal observation extraction (`lib/journal-extraction/mock-extractor.ts`)
  and lab value extraction (`lib/extraction/mock-extractor.ts`) are
  keyword-matching and fixed mock data respectively, running entirely inside
  the Next.js process.
- Setting `AI_PROVIDER=anthropic` or `AI_PROVIDER=openai` (plus the matching
  API key) turns on real extraction — see `lib/ai/`. This is the one place in
  the app that sends personal health content to a third party:
  - **Lab extraction** (`lib/extraction/ai-lab-extractor.ts`) sends the
    uploaded document's bytes (the PDF/image itself) and a fixed system
    prompt to the configured provider's API, and gets back structured JSON.
  - **Journal extraction** (`lib/journal-extraction/ai-extractor.ts`) sends
    the entry's raw text (not stored anywhere else outside the local DB) to
    the same provider.
  - Both send only what's needed for that single extraction call — no
    conversation history, no other health data, no bulk export. Neither
    Anthropic nor OpenAI is called for anything else in this app; the Coach,
    Insights, and readiness scores remain local mock logic.
  - Whichever provider you configure is subject to that provider's own data
    handling policy for API traffic once the request leaves this machine —
    review Anthropic's or OpenAI's API terms before turning this on with
    real personal health documents.
  - The `LabDocumentExtractor` and `JournalObservationExtractor` interfaces
    (`lib/extraction/types.ts`, `lib/journal-extraction/types.ts`) exist
    specifically so this is swappable and auditable in one place each
    (`getLabDocumentExtractor()`, `getJournalObservationExtractor()`) —
    nothing calls a provider SDK directly from anywhere else.
- The Coach (`lib/mock-data/coach-responses.ts`) is rule-based pattern
  matching against a fixed set of canned responses — no network call, no
  data leaves the process, regardless of `AI_PROVIDER`.

## Logging

- Server Actions and services (`lib/actions/*`, `lib/services/*`) don't log
  request bodies, journal text, or extracted health values. Next.js's own
  dev server logs request method/path/status/timing, not payloads.
- The AI provider clients (`lib/ai/anthropic-provider.ts`,
  `lib/ai/openai-provider.ts`) only log on failure, and only a short error
  message — never the prompt, the attached document, or the model's
  response. `LabExtractionSession.rawExtraction` does persist the model's
  structured JSON output locally (for debugging a bad extraction), but this
  stays in `data/app.db` like everything else — it is not sent anywhere
  beyond the one API call that produced it.
- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` live only in `.env` (gitignored) and
  are read via `process.env` at request time — never logged, never sent
  anywhere except as the API's own auth header.

## The Coach sends only a small, already-decided summary — never your raw data

The Coach's prioritization (context building, candidate generation, scoring,
safety classification) is entirely local, exactly like the pattern engine
below. The only optional external call is for phrasing an already-decided
answer into natural language (see `docs/COACH_ARCHITECTURE.md`, "LLM role").
That call — made only when `AI_PROVIDER` is configured — sends a minimized
payload: the question, a safety classification, goal/pattern **titles**
(not full records), journal entries as **category counts only** (never raw
text), the 3 decided priorities, and medication/supplement **names only**
(never doses) when the question is itself about personal health. No
wearable export, no raw journal text, and no full medical history is ever
sent. A higher-risk question (e.g. about a medication change or an urgent
symptom) never reaches the AI provider at all — the safety layer answers it
locally, unconditionally, before any external call would happen. If no AI
provider is configured, the Coach still works — its priorities come from
the same local, deterministic scoring either way.

## The pattern engine runs entirely locally

The `/insights` feature (baselines, trends, and exposure/outcome
associations — see `docs/ANALYTICS_ARCHITECTURE.md`) is plain, deterministic
TypeScript running in this same Node process against `data/app.db`. No
journal text, biomarker value, or derived statistic is sent to Anthropic,
OpenAI, or anywhere else as part of "Analyze my health data" — regardless of
whether `AI_PROVIDER` is configured. The only network calls this app ever
makes with personal health content are the single-document/single-entry
extraction calls described below; the pattern engine's full longitudinal
dataset is never transmitted anywhere.

## Wearable data import runs entirely locally

Importing an Amazfit/Zepp export or a generic CSV (see
`docs/WEARABLE_ARCHITECTURE.md`) follows the same path as everything else:
**Phone/Mac → Meridian → local parsing (in memory, no temp files) → SQLite.**
No wearable export file — zip, CSV, or JSON — is ever sent to Anthropic or
OpenAI, regardless of `AI_PROVIDER` configuration; parsing is deterministic
TypeScript with no LLM involved at any point (see "No AI parsing of
structured exports" in the wearable architecture doc). Uploaded zip archives
are treated as untrusted input — every entry is checked against path
traversal before extraction, and only recognized file types are read.

## Local-network access from your phone (`npm run dev:network`)

`npm run dev:network` binds the dev server to `0.0.0.0` instead of only
`localhost`, so a phone on the same Wi-Fi can reach it — this is what makes
"install Meridian on your phone" possible without any hosting. The data path
is: **Phone → your Wi-Fi network → your Mac → Meridian → `data/app.db` /
`data/uploads/` on your Mac's disk.** Nothing leaves your home network, and
nothing is uploaded to any cloud service by this feature.

Two things worth understanding before using it:

- **Anyone else on that Wi-Fi network can also reach the app** while
  `dev:network` is running — there's still no login (see below). Use it on
  a home network you trust, not a coffee shop or shared/office Wi-Fi.
- **Your Mac has to be on and running the server** for your phone to reach
  it. This is fundamentally different from a hosted app: closing the laptop
  or stopping the process makes it unreachable until you start it again.

Plain `npm run dev` (without `:network`) only listens on `localhost` and
isn't reachable from your phone at all — use that when you don't need
phone access.

## Future: private remote access (not implemented)

This phase deliberately does not set up access from outside your home
network — no tunnel, no port forwarding, no cloud deployment is configured
automatically, and none should be, without deliberately choosing an
authenticated approach first. If remote access is wanted later, reasonable
options, roughly in order of preference for a personal-health app:

- **Tailscale (or another private VPN)** — puts your phone and Mac on the
  same private virtual network wherever you are, with no public-facing
  ports opened. This is the option that best matches "your data stays on
  your Mac" while adding remote reach.
- **Self-hosting on a server you control**, behind real authentication —
  a bigger step, since it also means revisiting the "single-user, no login"
  model in `docs/DATA_MODEL.md`.
- **Cloud deployment** — the last choice for this app's threat model; it
  would mean health data leaving your own hardware, and needs encryption at
  rest, real auth, and a data-handling policy decided deliberately, not as
  a side effect of "make it reachable."

Whichever option comes later, prefer private authenticated access
(Tailscale/VPN-style) over exposing the app directly to the public internet.

## Single-user model, not authentication

There is intentionally no login system yet. "Local-first single-user" here
means the app assumes whoever can reach it is the one user — the same trust
boundary as any other file on your computer. This is a real limitation, not
a privacy feature: anyone with access to this machine (or a copy of
`data/app.db`) can read everything. Don't deploy this build anywhere
multi-user or internet-facing without adding real authentication and access
control first.

With the permanent local service (`npm run local:install` — see README,
"Running Meridian permanently on your Mac") running and bound to your LAN
interface for iPhone access, this trust boundary extends to **anyone on the
same Wi-Fi/LAN who knows or guesses the address** — not just people with
physical access to the Mac. This is still strictly local-network-only (no
router port forwarding, no public tunnel, nothing reachable from the
internet), so the exposure is bounded by who's on your home network — but
it is a real widening from "local machine only," worth knowing about before
running it on a shared, office, or public Wi-Fi network. Don't deploy this
build anywhere multi-user or internet-facing without adding real
authentication and access control first.

## Phase 7 — the External AI switch, demo mode, and the knowledge layer

- **`Profile → Privacy & AI → External AI`** is a real, DB-backed kill
  switch (`AppSettings.externalAiEnabled`, `lib/services/settings.service.ts`)
  layered on top of the `.env`-based provider selection described above.
  `getAiProvider()` (`lib/ai/index.ts`) checks this flag first and returns
  `null` immediately when it's off — regardless of what's in `.env` — so lab
  extraction, journal structuring, and Coach phrasing all fall back to their
  deterministic/mock implementation with zero code changes needed anywhere
  else. Analytics, insights, wearable import, knowledge search, and
  prioritization scoring were already fully local and are unaffected by this
  setting either way. See `/privacy` in the app for a live dashboard of
  exactly this "local only" vs. "external AI when enabled" split.
- **Demo mode** (`AppSettings.demoMode`, on by default) makes the existing
  demo/real data isolation from Phase 5 (the presence or absence of
  `dataSourceId` on a `BiomarkerMeasurement`) visible in the UI as a banner
  ("DEMO MODE — Alex · Synthetic data") rather than only being an implicit
  database-level distinction. Turning it off only changes the indicator — it
  never deletes or modifies any data; the actual guard against demo-seed
  commands wiping real data is still the pre-existing
  `scripts/check-safe-to-reset.ts` gate.
- **The knowledge layer** (`docs/KNOWLEDGE_ARCHITECTURE.md`) runs entirely
  locally like the pattern engine and wearable import above: Markdown
  parsing, content hashing, and lexical search are all plain TypeScript
  against `data/app.db`, with no embeddings, no vector database, and no
  external call at any point — including when the Coach retrieves knowledge
  excerpts to answer a question.
- **Imported knowledge content is never rendered as HTML.** The knowledge
  document viewer (`app/knowledge/[id]/page.tsx`) and every Body/biomarker
  Knowledge section render a chunk's `content` as plain React text (e.g.
  `<p>{content}</p>`), never via `dangerouslySetInnerHTML` or a Markdown-to-
  HTML renderer. React escapes all string content by default, so a
  `<script>` tag or other markup inside an imported file is displayed as
  inert text, never executed — see
  `tests/knowledge-markdown-parser.test.ts`, "never interprets raw
  HTML/script tags as structure."

## V1 hardening — secrets, logging, and dependency findings

- **`.env.example` fix**: the repository's `.gitignore` used a blanket
  `.env*` pattern that also matched `.env.example` — the committed template
  README setup instructions reference (`cp .env.example .env`) was never
  actually tracked in git. Fixed with a `!.env.example` exception; `.env`
  itself (where real keys live) remains gitignored.
- **Error logging** (`lib/services/extraction.service.ts`,
  `lib/services/journal.service.ts`): both previously logged the raw caught
  error object on an AI extraction failure. Some AI SDK error shapes attach
  the original request as an extra property, which could have put a lab
  document's bytes or raw journal text into server logs. Both now log only
  `err.message`, matching what this document already claimed ("only a short
  error message — never the prompt").
- **Dependency audit** (`npm audit`): 4 high-severity findings, unchanged
  since Phase 5 —
  - `deepmerge-ts` (stack exhaustion on recursive merges) and `mysql2`
    (auth-downgrade credential leak; decompression-bomb DoS), both pulled
    in transitively via `prisma` → `@prisma/config`'s dependency chain
    (Prisma's own CLI tooling, not the runtime client).
  - **Runtime exposure**: none found. Meridian's only database driver is
    `@prisma/adapter-better-sqlite3` against a local SQLite file — the
    `mysql2` code path is never loaded or executed by this app at runtime.
  - **Mitigation status**: no fix is available without `prisma@6.19.3` (a
    major downgrade from the `7.10.0` this app is built against) per
    `npm audit fix --force`'s own output — not applied, since "do not
    blindly upgrade/downgrade majors" without evaluating breakage. This is
    a real, currently-unpatched vulnerability in a dependency of a
    dependency, not a claim that the app is secure because of how it's
    used — worth re-checking each time Prisma ships a compatible fix.

## What a future cloud/multi-user version would need to revisit

- Encryption at rest for `data/app.db` and `data/uploads/` (currently plain
  files, appropriate for a single trusted local machine, not for shared or
  cloud storage).
- Real authentication and per-user data isolation (the schema has no
  `userId` foreign keys anywhere yet — see `docs/DATA_MODEL.md`).
- An explicit, user-visible consent and data-export/delete flow before any
  data leaves the local machine (e.g. once a real AI extractor is wired up).
