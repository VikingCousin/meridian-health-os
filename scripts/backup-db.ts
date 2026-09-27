/**
 * `npm run db:backup` — copies data/app.db to a timestamped file under
 * data/backups/. Never overwrites a previous backup (each run gets its own
 * filename). No cloud backup, no automatic pruning — see
 * docs/WEARABLE_ARCHITECTURE.md, "Backup," for restore steps and for how
 * data/uploads/ (lab documents) should be backed up alongside this.
 */
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";

const projectRoot = path.join(__dirname, "..");
const dbPath = process.env.DATABASE_URL?.replace(/^file:/, "") ?? "./data/app.db";
const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(projectRoot, dbPath);
const backupsDir = path.join(projectRoot, "data", "backups");

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function main() {
  if (!existsSync(resolvedDbPath)) {
    // Not fatal: this script is also chained automatically before `db:reset`
    // (see package.json), where "no database yet" is the normal first-run
    // case, not an error.
    console.log(`No database found at ${resolvedDbPath} — nothing to back up.`);
    return;
  }

  mkdirSync(backupsDir, { recursive: true });
  const backupPath = path.join(backupsDir, `app-${timestamp()}.db`);
  copyFileSync(resolvedDbPath, backupPath);

  console.log(`Backed up ${resolvedDbPath}`);
  console.log(`       -> ${backupPath}`);
  console.log("\nTo restore: stop the dev server, then copy that file back over data/app.db:");
  console.log(`  cp ${path.relative(projectRoot, backupPath)} data/app.db`);
  console.log("\nNote: this backs up the database only. Uploaded lab documents live separately");
  console.log("under data/uploads/ — copy that directory too if you want a complete backup.");
}

main();
