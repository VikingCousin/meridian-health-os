/**
 * Pre-flight guard for `npm run db:reset`, which shells out to
 * `prisma migrate reset --force` — a command that drops and recreates the
 * whole database *before* prisma/seed.ts's own `seed` hook ever runs, so
 * that script's guard runs too late to stop it. This script runs first and
 * aborts the `&&` chain (see package.json) if real data would be destroyed.
 * `ALLOW_DESTRUCTIVE_RESET=1` (used by `npm run demo:reset`) is the
 * explicit, deliberate override — see docs/WEARABLE_ARCHITECTURE.md,
 * "Destructive reset safety."
 *
 * Two independent signals are checked, since either alone can miss real
 * data (V1 hardening — a real user who never imported a wearable, only
 * uploaded labs/journaled/set goals, was previously unprotected):
 *   1. `AppSettings.demoMode === false` — the explicit, authoritative
 *      real-mode declaration (also the state a fresh, never-seeded database
 *      defaults to — see lib/services/settings.service.ts).
 *   2. A real, successfully-imported wearable data source — kept as a
 *      belt-and-suspenders check for the case where demoMode hasn't been
 *      toggled yet even though real device data already exists.
 */
import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

async function main() {
  if (process.env.ALLOW_DESTRUCTIVE_RESET === "1") return;

  const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./data/app.db" });
  const prisma = new PrismaClient({ adapter });

  try {
    const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
    if (settings && settings.demoMode === false) {
      console.error("\nRefusing to reset: this database is marked as real-user mode (AppSettings.demoMode = false).");
      console.error("`prisma migrate reset` drops the entire database, including all real personal health data.");
      console.error("If you really want to wipe everything and reload the demo dataset, run:\n");
      console.error("  npm run demo:reset\n");
      process.exit(1);
    }

    const realDataSources = await prisma.healthDataSource.count({ where: { lastSuccessfulImportAt: { not: null } } });
    if (realDataSources > 0) {
      console.error(`\nRefusing to reset: ${realDataSources} data source(s) have a real, successful import.`);
      console.error("`prisma migrate reset` drops the entire database, including any real wearable/lab data you've imported.");
      console.error("If you really want to wipe everything and reload the demo dataset, run:\n");
      console.error("  npm run demo:reset\n");
      process.exit(1);
    }
  } catch {
    // Table doesn't exist yet (no migrations applied) — nothing real to protect.
  } finally {
    await prisma.$disconnect();
  }
}

main();
