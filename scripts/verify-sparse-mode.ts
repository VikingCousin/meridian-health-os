/**
 * Standalone verification for Sections 11/12 of the V1 hardening spec:
 * Coach and Insights behavior on an empty, then sparse, real-user dataset.
 * Runs against a fully disposable temp SQLite file — never data/app.db or
 * data/test.db (the latter is shared/parallel across the main Vitest suite,
 * which makes a true "empty dataset" assertion unreliable there).
 *
 * Run with: npx tsx scripts/verify-sparse-mode.ts
 */
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`  ok — ${message}`);
  }
}

async function main() {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "meridian-sparse-verify-"));
  const dbPath = path.join(tempDir, "sparse.db");
  const projectRoot = path.join(__dirname, "..");

  try {
    execSync("npx prisma migrate deploy", {
      cwd: projectRoot,
      env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
      stdio: "pipe",
    });

    // Must be set before any lib/db/prisma.ts import anywhere in the chain.
    process.env.DATABASE_URL = `file:${dbPath}`;

    console.log("\n== A. Empty dataset ==");
    const { analyzeHealthData } = await import("../lib/analytics/health-analysis.service");
    const { prisma } = await import("../lib/db/prisma");

    const emptySummary = await analyzeHealthData();
    assert(emptySummary.insightsCreated === 0, `0 insights created on an empty dataset (got ${emptySummary.insightsCreated})`);
    const insightCount = await prisma.healthInsight.count();
    assert(insightCount === 0, `0 HealthInsight rows exist after analysis (got ${insightCount})`);

    const { askCoach } = await import("../lib/coach/coach-orchestrator.service");
    const emptyResponse = await askCoach("What should I focus on this week?");
    assert(emptyResponse.priorities.length === 0, `Coach returns 0 priorities on an empty dataset (got ${emptyResponse.priorities.length})`);
    assert(!emptyResponse.summary.match(/\d+(\.\d+)?\s?(mg\/dL|ms|bpm|%)/), "Coach's summary contains no fabricated numeric health values");
    assert(emptyResponse.evidence.length === 0, `Coach cites 0 evidence items on an empty dataset (got ${emptyResponse.evidence.length})`);

    console.log("\n== B. Sparse dataset (one goal, one journal entry, no biomarkers) ==");
    await prisma.goal.create({
      data: { title: "Sleep better", category: "SLEEP", kind: "SUPPORTING", priority: "MEDIUM", status: "ON_TRACK" },
    });
    await prisma.journalEntry.create({ data: { text: "Slept okay, a bit stressed about work.", entryDate: new Date() } });

    const sparseSummary = await analyzeHealthData();
    assert(
      sparseSummary.insightsCreated === 0,
      `Sparse dataset (1 goal, 1 journal entry, 0 biomarkers) still produces 0 insights — not enough occasions for any association/trend (got ${sparseSummary.insightsCreated})`
    );

    const sparseResponse = await askCoach("What should I focus on this week?");
    assert(
      sparseResponse.priorities.every((p) => p.confidence === "low" || p.evidenceLevel === "UNKNOWN" || p.evidenceLevel === "EMERGING" || p.linkedInsightIds.length === 0),
      "Every sparse-dataset priority is goal-based/low-confidence, never claiming a strong personal pattern that doesn't exist"
    );
    console.log(`  (Coach returned ${sparseResponse.priorities.length} goal-based suggestion(s) — acceptable, not a fabricated pattern.)`);

    await prisma.$disconnect();
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }

  if (process.exitCode === 1) {
    console.error("\nSparse/empty-mode verification FAILED — see above.");
  } else {
    console.log("\nAll sparse/empty-mode checks passed.");
  }
}

main();
