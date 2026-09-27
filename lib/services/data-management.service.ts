import { existsSync, mkdirSync, copyFileSync, statSync, readdirSync } from "node:fs";
import path from "node:path";
import JSZip from "jszip";
// A one-off, read-only export spans every domain (profile, goals,
// experiments, biomarkers, journal, insights, wearables, knowledge) — routing
// it through eight separate repositories would add indirection with no
// benefit, so this file is a deliberate, documented exception to "only
// repositories touch Prisma directly" (see docs/DATA_PORTABILITY.md).
import { prisma } from "@/lib/db/prisma";
import { buildExportManifest } from "@/lib/services/export-manifest";

const PROJECT_ROOT = process.cwd();
const DB_PATH = (process.env.DATABASE_URL?.replace(/^file:/, "") ?? "./data/app.db").replace(/^\.\//, "");
const RESOLVED_DB_PATH = path.isAbsolute(DB_PATH) ? DB_PATH : path.join(PROJECT_ROOT, DB_PATH);
const BACKUPS_DIR = path.join(PROJECT_ROOT, "data", "backups");
const UPLOADS_DIR = path.join(PROJECT_ROOT, "data", "uploads");

export interface BackupStatus {
  dbSizeBytes: number | null;
  lastBackupAt: Date | null;
  backupCount: number;
  uploadsSizeBytes: number;
  uploadsIncludedInBackup: boolean;
}

function dirSizeBytes(dir: string): number {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).reduce((sum, name) => {
    const full = path.join(dir, name);
    const stat = statSync(full);
    return sum + (stat.isFile() ? stat.size : 0);
  }, 0);
}

export async function getBackupStatus(): Promise<BackupStatus> {
  const dbSizeBytes = existsSync(RESOLVED_DB_PATH) ? statSync(RESOLVED_DB_PATH).size : null;
  let lastBackupAt: Date | null = null;
  let backupCount = 0;
  if (existsSync(BACKUPS_DIR)) {
    const files = readdirSync(BACKUPS_DIR).filter((f) => f.endsWith(".db"));
    backupCount = files.length;
    for (const f of files) {
      const mtime = statSync(path.join(BACKUPS_DIR, f)).mtime;
      if (!lastBackupAt || mtime > lastBackupAt) lastBackupAt = mtime;
    }
  }
  return {
    dbSizeBytes,
    lastBackupAt,
    backupCount,
    uploadsSizeBytes: dirSizeBytes(UPLOADS_DIR),
    // The DB-copy backup below never includes data/uploads/ — surfaced here
    // so the UI doesn't overstate what a backup actually protects.
    uploadsIncludedInBackup: false,
  };
}

export interface CreateBackupResult {
  fileName: string;
  sizeBytes: number;
  createdAt: Date;
}

export async function createBackup(): Promise<CreateBackupResult> {
  if (!existsSync(RESOLVED_DB_PATH)) {
    throw new Error("No database file found to back up.");
  }
  mkdirSync(BACKUPS_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `app-${timestamp}.db`;
  const backupPath = path.join(BACKUPS_DIR, fileName);
  copyFileSync(RESOLVED_DB_PATH, backupPath);
  const stat = statSync(backupPath);
  return { fileName, sizeBytes: stat.size, createdAt: stat.mtime };
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

/**
 * Builds a local, portable archive of everything Meridian knows about the
 * user — never secrets or API keys, which live only in `.env` and are never
 * read here. See docs/DATA_PORTABILITY.md.
 */
export async function exportUserDataZip(): Promise<Buffer> {
  const [profile, goals, experiments, biomarkerMeasurements, journalEntries, insights, wearableMeasurements, knowledgeDocs] =
    await Promise.all([
      prisma.userProfile.findFirst({ include: { medicalHistory: true, medications: true, supplements: true } }),
      prisma.goal.findMany(),
      prisma.healthExperiment.findMany({ include: { outcomes: true } }),
      prisma.biomarkerMeasurement.findMany({ include: { biomarkerDefinition: true } }),
      prisma.journalEntry.findMany({ include: { observations: true } }),
      prisma.healthInsight.findMany({ include: { evidence: true } }),
      prisma.biomarkerMeasurement.findMany({ where: { sourceType: "WEARABLE" }, include: { biomarkerDefinition: true } }),
      prisma.healthKnowledgeDocument.findMany({ include: { chunks: true } }),
    ]);

  const zip = new JSZip();
  zip.file("profile.json", JSON.stringify(profile, null, 2));
  zip.file("goals.json", JSON.stringify(goals, null, 2));
  zip.file("experiments.json", JSON.stringify(experiments, null, 2));
  zip.file(
    "biomarkers.csv",
    toCsv(
      biomarkerMeasurements.map((m) => ({
        biomarker: m.biomarkerDefinition.displayName,
        value: m.value,
        unit: m.unit,
        measuredAt: m.measuredAt.toISOString(),
        sourceType: m.sourceType,
        verified: m.verified,
      }))
    )
  );
  zip.file(
    "journal.csv",
    toCsv(
      journalEntries.map((e) => ({
        entryDate: e.entryDate.toISOString(),
        text: e.text,
        observationCount: e.observations.length,
      }))
    )
  );
  zip.file("insights.json", JSON.stringify(insights, null, 2));
  zip.file(
    "wearables.csv",
    toCsv(
      wearableMeasurements.map((m) => ({
        metric: m.biomarkerDefinition.displayName,
        value: m.value,
        unit: m.unit,
        measuredAt: m.measuredAt.toISOString(),
      }))
    )
  );

  const knowledgeFolder = zip.folder("knowledge");
  for (const doc of knowledgeDocs) {
    const body = doc.chunks
      .sort((a, b) => a.order - b.order)
      .map((c) => `## ${c.heading}\n\n${c.content}`)
      .join("\n\n");
    const safeName = doc.title.replace(/[^a-z0-9-_ ]/gi, "").slice(0, 80) || doc.id;
    knowledgeFolder?.file(`${safeName}.md`, `# ${doc.title}\n\n${body}`);
  }

  const manifest = buildExportManifest(
    {
      goals: goals.length,
      experiments: experiments.length,
      biomarkerMeasurements: biomarkerMeasurements.length,
      journalEntries: journalEntries.length,
      insights: insights.length,
      knowledgeDocuments: knowledgeDocs.length,
    },
    ["profile.json", "goals.json", "experiments.json", "biomarkers.csv", "journal.csv", "insights.json", "wearables.csv", "knowledge/", "metadata.json"]
  );
  zip.file("metadata.json", JSON.stringify(manifest, null, 2));

  return zip.generateAsync({ type: "nodebuffer" });
}
