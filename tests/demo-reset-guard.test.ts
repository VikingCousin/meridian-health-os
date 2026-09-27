import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// Section 4: the pre-reset guard must refuse to let db:reset/demo:reset run
// against real-user data. Verified against a disposable temp DB, never
// data/app.db or the shared data/test.db.
describe("scripts/check-safe-to-reset.ts (disposable environment only)", () => {
  let tempDir: string;
  let dbPath: string;
  let client: PrismaClient;

  beforeAll(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), "meridian-reset-guard-"));
    dbPath = path.join(tempDir, "guard.db");
    execSync("npx prisma migrate deploy", {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
      stdio: "pipe",
    });
    const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
    client = new PrismaClient({ adapter });
  });

  afterAll(async () => {
    await client.$disconnect();
    rmSync(tempDir, { recursive: true, force: true });
  });

  function runGuard(env: Record<string, string> = {}): { exitCode: number; stderr: string } {
    try {
      execSync("npx tsx scripts/check-safe-to-reset.ts", {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: `file:${dbPath}`, ...env },
        stdio: "pipe",
      });
      return { exitCode: 0, stderr: "" };
    } catch (err) {
      const e = err as { status: number; stderr: Buffer };
      return { exitCode: e.status, stderr: e.stderr?.toString() ?? "" };
    }
  }

  it("allows reset on a freshly migrated, never-touched database", () => {
    const result = runGuard();
    expect(result.exitCode).toBe(0);
  });

  it("refuses reset once AppSettings.demoMode is explicitly false (real-user mode declared)", async () => {
    await client.appSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", demoMode: false, externalAiEnabled: true },
      update: { demoMode: false },
    });
    const result = runGuard();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("real-user mode");
  });

  it("still allows reset with the explicit ALLOW_DESTRUCTIVE_RESET override", () => {
    const result = runGuard({ ALLOW_DESTRUCTIVE_RESET: "1" });
    expect(result.exitCode).toBe(0);
  });

  it("refuses reset when a real wearable import exists, even if demoMode is true", async () => {
    await client.appSettings.update({ where: { id: "singleton" }, data: { demoMode: true } });
    await client.healthDataSource.create({
      data: {
        type: "WEARABLE",
        provider: "AMAZFIT",
        displayName: "Real Device",
        status: "CONNECTED",
        lastSuccessfulImportAt: new Date(),
        metadata: {},
      },
    });
    const result = runGuard();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("successful import");
  });
});
