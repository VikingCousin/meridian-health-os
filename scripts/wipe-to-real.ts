/**
 * `npm run db:wipe-to-real` — the "deterministic real-user initialization
 * path" promised in docs/DATA_MODEL.md ("Real-user mode"): produces a
 * genuinely empty, fully-migrated database with NO seed data at all, unlike
 * `prisma migrate reset` (which always re-runs the configured seed hook —
 * see prisma7.config.ts's `migrations.seed` — there is no supported
 * `--skip-seed` flag on Prisma 7's `migrate reset`).
 *
 * Deletes the SQLite file and its WAL/journal siblings, then runs
 * `prisma migrate deploy` (which never triggers a seed hook) to recreate an
 * empty schema — the same technique tests/global-setup.ts already uses for
 * the disposable test database.
 *
 * This script does NOT perform its own safety check — it's always chained
 * after scripts/check-safe-to-reset.ts and scripts/backup-db.ts in
 * package.json's `db:wipe-to-real`, which must run first.
 */
import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";

const projectRoot = path.join(__dirname, "..");
const dbPath = process.env.DATABASE_URL?.replace(/^file:/, "") ?? "./data/app.db";
const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(projectRoot, dbPath);

for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  const file = resolvedDbPath + suffix;
  if (existsSync(file)) {
    unlinkSync(file);
    console.log(`Removed ${file}`);
  }
}

execSync("npx prisma migrate deploy", { cwd: projectRoot, stdio: "inherit" });

// The biomarker catalog (definitions only — canonicalKey/description/units,
// no measured values) and the curated knowledge library are structural
// reference content, not personal or demo data — lab extraction and
// wearable import both need the catalog populated to have anything to map
// values onto. Re-seeding them here is what makes db:wipe-to-real produce a
// genuinely usable real-user database rather than just an empty one.
async function seedReferenceData() {
  const { prisma } = await import("../lib/db/prisma");
  const { biomarkerCatalog } = await import("../lib/domain/biomarker-catalog");
  const { importMarkdown } = await import("../lib/knowledge/knowledge.service");
  const { CURATED_KNOWLEDGE_DOCS } = await import("../lib/knowledge/curated-seed");

  for (const entry of biomarkerCatalog) {
    await prisma.biomarkerDefinition.create({
      data: {
        canonicalKey: entry.canonicalKey,
        displayName: entry.displayName,
        shortName: entry.shortName,
        category: entry.category,
        defaultUnit: entry.defaultUnit,
        description: entry.description,
        whyItMatters: entry.whyItMatters,
        bodySystem: entry.bodySystem,
        aliases: entry.aliases,
      },
    });
  }
  console.log(`Seeded ${biomarkerCatalog.length} biomarker definitions (catalog only — no measured values).`);

  for (const doc of CURATED_KNOWLEDGE_DOCS) {
    await importMarkdown({ raw: doc.markdown, fallbackTitle: doc.fileName, sourceType: "CURATED" });
  }
  console.log(`Seeded ${CURATED_KNOWLEDGE_DOCS.length} curated knowledge documents.`);

  await prisma.$disconnect();
}

seedReferenceData().then(() => {
  console.log("\nDatabase re-created with reference data only (no profile, no goals, no measurements, no journal, no demo data)");
  console.log("— ready for real profile/goals/labs/journal entry through the app.");
});
