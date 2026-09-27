# Data portability — backup & export

Meridian is local-first: your data lives in one SQLite file and a folder of
uploaded documents on this machine, with no server-side copy anywhere. This
document covers the two ways to get a copy of it out.

## Backup (whole database, for disaster recovery)

**What it does**: copies `data/app.db` to a timestamped file under
`data/backups/` (e.g. `app-2026-09-08T18-20-53-603Z.db`). Every run creates a
new file — nothing is ever overwritten.

**Two ways to trigger it**:
- CLI: `npm run db:backup` (existing since Phase 5, `scripts/backup-db.ts`).
- UI: Profile → Data Management → **Create backup**. This calls the same
  logic through a Server Action (`lib/actions/data-management.ts` →
  `lib/services/data-management.service.ts`), so both paths produce an
  identical file.

**What it does not include**: `data/uploads/` (your uploaded lab report
files). The Data Management panel shows the uploads folder's size next to
the backup button specifically so this isn't a silent gap — if you want a
complete backup, also copy `data/uploads/` alongside the `.db` file.

**Restore workflow (manual, by design)**: this phase deliberately does not
add a one-click "restore" button. Restoring means replacing your current,
possibly-more-recent database with an older one — a genuinely destructive,
hard-to-undo action, and the phase brief was explicit that this should only
be automated "if it can be done safely with clear confirmation," and to
prefer documentation over risky automation otherwise. The safe manual
process:

```bash
# 1. Stop the app (Ctrl+C on npm run dev / dev:network).
# 2. Optionally back up your *current* data/app.db first, in case you want
#    to undo the restore itself:
npm run db:backup
# 3. Copy the backup you want back over the live database:
cp data/backups/app-<timestamp>.db data/app.db
# 4. Restart the app.
```

If you also backed up `data/uploads/`, restore that directory the same way.

## Export (a portable copy of your data, for you to keep)

**What it does**: Profile → Data Management → **Export my data** builds a
ZIP archive in memory (`lib/services/data-management.service.ts`,
`exportUserDataZip()`) and downloads it directly to your device — nothing is
uploaded anywhere; the archive is generated and streamed entirely within
this same local process.

**Contents**:

| File | Contents |
|---|---|
| `profile.json` | Your profile, medical history, medications, supplements |
| `goals.json` | All goals |
| `experiments.json` | All experiments and their outcomes |
| `biomarkers.csv` | Every biomarker measurement (lab, manual, wearable) |
| `journal.csv` | Every journal entry (raw text) and its observation count |
| `insights.json` | Every persisted `HealthInsight` and its evidence |
| `wearables.csv` | The subset of biomarker measurements sourced from a wearable import |
| `knowledge/*.md` | One Markdown file per knowledge document (curated + imported), reconstructed from its sections |
| `metadata.json` | Export timestamp and row counts, for a sanity check on what's inside |

**Never included**: API keys, `.env` contents, or anything from
`process.env` — the export function only ever reads from the database
(`prisma.*` queries), never from environment configuration. See
`docs/PRIVACY_ARCHITECTURE.md` for where secrets actually live.

**Format choices**: JSON for structured, nested records (profile, goals,
experiments, insights); CSV for flat time-series data (biomarkers, journal,
wearables) so it opens directly in a spreadsheet; Markdown for knowledge
documents so they're re-readable as the notes they are, not a JSON blob.

## Export manifest (versioned, for future round-tripping)

`metadata.json` is a versioned manifest, not just a counts dump —
`lib/services/export-manifest.ts`:

```json
{
  "format": "meridian-export",
  "version": 1,
  "exportedAt": "2026-09-09T10:00:00.000Z",
  "files": ["profile.json", "goals.json", "..."],
  "counts": { "goals": 3, "experiments": 1, "...": "..." }
}
```

`validateExportManifest()` (Zod-backed) checks this shape and is the seam a
future "import from export" feature would use first, before trusting
anything else in the archive — see `tests/export-validation.test.ts` for
the structural checks run against every real export (documented file list
present, valid UTF-8, no secret-looking strings, no raw filesystem paths,
explicit UTC timestamps, and per-document source provenance preserved for
knowledge files). No import UI exists yet — this manifest just means a
future one won't need to guess the archive's shape or version.

## Known limitations

- Export is a point-in-time snapshot, not a sync mechanism — there's no way
  to import an exported ZIP back into Meridian yet (re-import is a
  reasonable future addition, not built this phase).
- Uploaded lab document *files* (PDFs/images) are not included in the
  export ZIP, only the biomarker values already extracted from them —
  copying `data/uploads/` directly (as with backup, above) is the way to
  get the original files.
