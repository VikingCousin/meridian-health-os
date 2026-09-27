-- CreateTable
CREATE TABLE "HealthDataSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "deviceName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
    "lastImportAt" DATETIME,
    "lastSuccessfulImportAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "metadata" JSONB NOT NULL
);

-- CreateTable
CREATE TABLE "WearableImportSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dataSourceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "originalFileName" TEXT,
    "fileHash" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "recordsFound" INTEGER NOT NULL DEFAULT 0,
    "recordsImported" INTEGER NOT NULL DEFAULT 0,
    "recordsSkipped" INTEGER NOT NULL DEFAULT 0,
    "recordsFailed" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL,
    "errorMessage" TEXT,
    CONSTRAINT "WearableImportSession_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "HealthDataSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SleepSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dataSourceId" TEXT NOT NULL,
    "externalId" TEXT,
    "sleepDay" DATETIME NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "deepMinutes" INTEGER,
    "remMinutes" INTEGER,
    "lightMinutes" INTEGER,
    "awakeMinutes" INTEGER,
    "sleepScore" INTEGER,
    "averageHeartRate" REAL,
    "averageHrv" REAL,
    "averageSpo2" REAL,
    "respiratoryRate" REAL,
    "sourceMetadata" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SleepSession_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "HealthDataSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkoutSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dataSourceId" TEXT NOT NULL,
    "externalId" TEXT,
    "type" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "averageHeartRate" REAL,
    "maxHeartRate" REAL,
    "trainingLoad" REAL,
    "distanceKm" REAL,
    "calories" REAL,
    "sourceMetadata" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkoutSession_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "HealthDataSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BiomarkerMeasurement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "biomarkerDefinitionId" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "measuredAt" DATETIME NOT NULL,
    "referenceMin" REAL,
    "referenceMax" REAL,
    "referenceText" TEXT,
    "personalTargetMin" REAL,
    "personalTargetMax" REAL,
    "sourceType" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    "dataSourceId" TEXT,
    "externalId" TEXT,
    "notes" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BiomarkerMeasurement_biomarkerDefinitionId_fkey" FOREIGN KEY ("biomarkerDefinitionId") REFERENCES "BiomarkerDefinition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BiomarkerMeasurement_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "HealthDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BiomarkerMeasurement_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "HealthDataSource" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BiomarkerMeasurement" ("biomarkerDefinitionId", "createdAt", "id", "measuredAt", "notes", "personalTargetMax", "personalTargetMin", "referenceMax", "referenceMin", "referenceText", "sourceDocumentId", "sourceType", "unit", "updatedAt", "value", "verified") SELECT "biomarkerDefinitionId", "createdAt", "id", "measuredAt", "notes", "personalTargetMax", "personalTargetMin", "referenceMax", "referenceMin", "referenceText", "sourceDocumentId", "sourceType", "unit", "updatedAt", "value", "verified" FROM "BiomarkerMeasurement";
DROP TABLE "BiomarkerMeasurement";
ALTER TABLE "new_BiomarkerMeasurement" RENAME TO "BiomarkerMeasurement";
CREATE INDEX "BiomarkerMeasurement_biomarkerDefinitionId_measuredAt_idx" ON "BiomarkerMeasurement"("biomarkerDefinitionId", "measuredAt");
CREATE UNIQUE INDEX "BiomarkerMeasurement_dataSourceId_externalId_key" ON "BiomarkerMeasurement"("dataSourceId", "externalId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "WearableImportSession_dataSourceId_idx" ON "WearableImportSession"("dataSourceId");

-- CreateIndex
CREATE INDEX "SleepSession_sleepDay_idx" ON "SleepSession"("sleepDay");

-- CreateIndex
CREATE UNIQUE INDEX "SleepSession_dataSourceId_externalId_key" ON "SleepSession"("dataSourceId", "externalId");

-- CreateIndex
CREATE INDEX "WorkoutSession_startedAt_idx" ON "WorkoutSession"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutSession_dataSourceId_externalId_key" ON "WorkoutSession"("dataSourceId", "externalId");
