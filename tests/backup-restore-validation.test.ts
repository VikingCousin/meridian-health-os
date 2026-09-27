import { describe, it, expect, afterAll } from "vitest";
import { copyFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { prisma } from "@/lib/db/prisma";

// Section 5 of the V1 hardening spec: prove a backup can actually be
// restored and read back with its relationships intact — never against the
// active development database (data/app.db is untouched by this whole
// suite; even the *source* here is the disposable data/test.db, and the
// "restore" target is a further-disposable temp-directory copy that's
// deleted at the end).
const MARKER = "TEST_BACKUP_RESTORE";

describe("backup + restore validation (disposable environment only)", () => {
  const cleanupIds: { model: string; id: string }[] = [];
  let tempDir: string;
  let restoredDbPath: string;
  let restoredClient: PrismaClient;

  afterAll(async () => {
    await restoredClient?.$disconnect();
    if (tempDir && existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });

    await prisma.coachPriority.deleteMany({ where: { title: { startsWith: MARKER } } });
    await prisma.healthKnowledgeChunk.deleteMany({ where: { document: { title: { startsWith: MARKER } } } });
    await prisma.healthKnowledgeDocument.deleteMany({ where: { title: { startsWith: MARKER } } });
    await prisma.insightEvidence.deleteMany({ where: { insight: { title: { startsWith: MARKER } } } });
    await prisma.healthInsight.deleteMany({ where: { title: { startsWith: MARKER } } });
    await prisma.goal.deleteMany({ where: { title: { startsWith: MARKER } } });
    await prisma.journalEntry.deleteMany({ where: { text: { startsWith: MARKER } } });
    await prisma.biomarkerMeasurement.deleteMany({ where: { biomarkerDefinition: { canonicalKey: { startsWith: MARKER.toLowerCase() } } } });
    await prisma.wearableImportSession.deleteMany({ where: { dataSource: { displayName: { startsWith: MARKER } } } });
    await prisma.healthDataSource.deleteMany({ where: { displayName: { startsWith: MARKER } } });
    await prisma.biomarkerDefinition.deleteMany({ where: { canonicalKey: { startsWith: MARKER.toLowerCase() } } });
    await prisma.userProfile.deleteMany({ where: { firstName: MARKER } });
  });

  it("creates one record of every documented export/backup category", async () => {
    const profile = await prisma.userProfile.create({
      data: { firstName: MARKER, dateOfBirth: new Date("1990-01-01"), heightCm: 175, timezone: "UTC" },
    });
    cleanupIds.push({ model: "userProfile", id: profile.id });

    const labDef = await prisma.biomarkerDefinition.create({
      data: { canonicalKey: `${MARKER.toLowerCase()}_lab`, displayName: "Test Lab Marker", category: "Test", aliases: [] },
    });
    await prisma.biomarkerMeasurement.create({
      data: { biomarkerDefinitionId: labDef.id, value: 42, unit: "mg/dL", measuredAt: new Date(), sourceType: "LAB_REPORT" },
    });

    const dataSource = await prisma.healthDataSource.create({
      data: { type: "WEARABLE", provider: "AMAZFIT", displayName: `${MARKER} Device`, status: "CONNECTED", metadata: {} },
    });
    const wearableDef = await prisma.biomarkerDefinition.create({
      data: { canonicalKey: `${MARKER.toLowerCase()}_wearable`, displayName: "Test Wearable Marker", category: "Test", aliases: [] },
    });
    await prisma.biomarkerMeasurement.create({
      data: {
        biomarkerDefinitionId: wearableDef.id,
        value: 55,
        unit: "ms",
        measuredAt: new Date(),
        sourceType: "WEARABLE",
        dataSourceId: dataSource.id,
        externalId: "ext-1",
      },
    });

    await prisma.journalEntry.create({ data: { text: `${MARKER} felt fine today`, entryDate: new Date() } });

    await prisma.goal.create({
      data: { title: `${MARKER} Sleep goal`, category: "SLEEP", kind: "SUPPORTING", priority: "MEDIUM", status: "ON_TRACK" },
    });

    const insight = await prisma.healthInsight.create({
      data: {
        fingerprint: `${MARKER}-fingerprint`,
        type: "TREND",
        title: `${MARKER} Insight`,
        summary: "Test insight summary",
        confidenceLevel: "POSSIBLE",
        confidenceScore: 40,
        firstObservedAt: new Date(),
        lastObservedAt: new Date(),
        metadata: {},
      },
    });
    await prisma.insightEvidence.create({
      data: { insightId: insight.id, sourceType: "BIOMARKER_MEASUREMENT", sourceId: "x", role: "SUPPORTING", metadata: {} },
    });

    await prisma.coachPriority.create({
      data: {
        interventionDefinitionId: "hydration",
        title: `${MARKER} Priority`,
        status: "ACCEPTED",
        score: 50,
        rank: 1,
        reason: "test",
        linkedGoalIds: [],
        linkedInsightIds: [],
        metadata: {},
      },
    });

    const knowledgeDoc = await prisma.healthKnowledgeDocument.create({
      data: { title: `${MARKER} Knowledge Doc`, sourceType: "USER_NOTES", contentHash: `${MARKER}-hash`, metadata: {} },
    });
    await prisma.healthKnowledgeChunk.create({
      data: { documentId: knowledgeDoc.id, heading: "Section", content: "Content", order: 0, keywords: [] },
    });

    // Sanity check before the file-level backup/restore step below.
    expect(await prisma.userProfile.count({ where: { firstName: MARKER } })).toBe(1);
  });

  it("restores the backup file into a disposable environment with matching record counts and intact relationships", async () => {
    // Force SQLite to flush its WAL to the main file before copying it —
    // otherwise a plain file copy can miss recently-committed rows.
    await prisma.$queryRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE)").catch(() => {});

    const sourceDbPath = path.join(process.cwd(), "data", "test.db");
    tempDir = mkdtempSync(path.join(os.tmpdir(), "meridian-restore-test-"));
    restoredDbPath = path.join(tempDir, "restored.db");
    copyFileSync(sourceDbPath, restoredDbPath);

    const adapter = new PrismaBetterSqlite3({ url: `file:${restoredDbPath}` });
    restoredClient = new PrismaClient({ adapter });

    const restoredProfile = await restoredClient.userProfile.findFirst({ where: { firstName: MARKER } });
    expect(restoredProfile).not.toBeNull();

    const restoredLabMeasurement = await restoredClient.biomarkerMeasurement.findFirst({
      where: { biomarkerDefinition: { canonicalKey: `${MARKER.toLowerCase()}_lab` } },
      include: { biomarkerDefinition: true },
    });
    expect(restoredLabMeasurement?.value).toBe(42);
    expect(restoredLabMeasurement?.biomarkerDefinition.displayName).toBe("Test Lab Marker");

    const restoredWearableMeasurement = await restoredClient.biomarkerMeasurement.findFirst({
      where: { biomarkerDefinition: { canonicalKey: `${MARKER.toLowerCase()}_wearable` } },
      include: { dataSource: true },
    });
    expect(restoredWearableMeasurement?.dataSource?.displayName).toBe(`${MARKER} Device`);

    const restoredJournal = await restoredClient.journalEntry.findFirst({ where: { text: { startsWith: MARKER } } });
    expect(restoredJournal).not.toBeNull();

    const restoredGoal = await restoredClient.goal.findFirst({ where: { title: `${MARKER} Sleep goal` } });
    expect(restoredGoal).not.toBeNull();

    const restoredInsight = await restoredClient.healthInsight.findUnique({
      where: { fingerprint: `${MARKER}-fingerprint` },
      include: { evidence: true },
    });
    expect(restoredInsight?.evidence).toHaveLength(1);

    const restoredPriority = await restoredClient.coachPriority.findFirst({ where: { title: `${MARKER} Priority` } });
    expect(restoredPriority?.status).toBe("ACCEPTED");

    const restoredKnowledgeDoc = await restoredClient.healthKnowledgeDocument.findUnique({
      where: { contentHash: `${MARKER}-hash` },
      include: { chunks: true },
    });
    expect(restoredKnowledgeDoc?.chunks).toHaveLength(1);
  });
});
