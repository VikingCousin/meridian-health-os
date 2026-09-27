import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";

// Runs scripts/verify-sparse-mode.ts as a child process against its own
// disposable temp SQLite database — a true "empty dataset" assertion isn't
// reliable against the shared, parallel-worker data/test.db used by the
// rest of this suite (see that script's own header comment), so this test
// just asserts the standalone verification exits clean.
describe("Coach + Insights on empty/sparse real-user data (Section 11/12)", () => {
  it(
    "produces 0 insights on empty data, 0 fabricated patterns on sparse data, and never crashes",
    () => {
      expect(() => execSync("npx tsx scripts/verify-sparse-mode.ts", { cwd: process.cwd(), stdio: "pipe" })).not.toThrow();
    },
    30_000
  );
});
