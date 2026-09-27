import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";

const TEST_DB_PATH = path.join(__dirname, "..", "data", "test.db");

export default async function setup() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const file = TEST_DB_PATH + suffix;
    if (existsSync(file)) unlinkSync(file);
  }

  execSync("npx prisma migrate deploy", {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, DATABASE_URL: "file:./data/test.db" },
    stdio: "inherit",
  });

  return async () => {
    for (const suffix of ["", "-journal", "-wal", "-shm"]) {
      const file = TEST_DB_PATH + suffix;
      if (existsSync(file)) unlinkSync(file);
    }
  };
}
