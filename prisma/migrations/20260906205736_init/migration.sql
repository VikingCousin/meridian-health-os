-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "dateOfBirth" DATETIME NOT NULL,
    "biologicalSex" TEXT,
    "heightCm" REAL NOT NULL,
    "currentWeightKg" REAL,
    "timezone" TEXT NOT NULL,
    "occupation" TEXT,
    "activityLevel" TEXT,
    "generalHealthNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MedicalHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "diagnosisDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'SELF_REPORTED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MedicalHistory_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Medication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dose" REAL,
    "unit" TEXT,
    "frequency" TEXT,
    "startedAt" DATETIME,
    "stoppedAt" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Medication_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Supplement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productName" TEXT,
    "dose" REAL,
    "unit" TEXT,
    "frequency" TEXT,
    "startedAt" DATETIME,
    "stoppedAt" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Supplement_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BiomarkerDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "canonicalKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "shortName" TEXT,
    "category" TEXT NOT NULL,
    "defaultUnit" TEXT,
    "description" TEXT,
    "bodySystem" TEXT,
    "aliases" JSONB NOT NULL DEFAULT [],
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BiomarkerMeasurement" (
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
    "notes" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BiomarkerMeasurement_biomarkerDefinitionId_fkey" FOREIGN KEY ("biomarkerDefinitionId") REFERENCES "BiomarkerDefinition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BiomarkerMeasurement_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "HealthDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HealthDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "localFilePath" TEXT NOT NULL,
    "fileSizeBytes" INTEGER,
    "documentDate" DATETIME,
    "providerName" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LabExtractionSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rawExtraction" TEXT,
    "extractorName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LabExtractionSession_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "HealthDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LabExtractionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "extractionSessionId" TEXT NOT NULL,
    "rawName" TEXT NOT NULL,
    "suggestedBiomarkerDefinitionId" TEXT,
    "value" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "referenceMin" REAL,
    "referenceMax" REAL,
    "confidence" REAL,
    "accepted" BOOLEAN NOT NULL DEFAULT true,
    "editedByUser" BOOLEAN NOT NULL DEFAULT false,
    "finalBiomarkerDefinitionId" TEXT,
    "resultingMeasurementId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LabExtractionItem_extractionSessionId_fkey" FOREIGN KEY ("extractionSessionId") REFERENCES "LabExtractionSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LabExtractionItem_suggestedBiomarkerDefinitionId_fkey" FOREIGN KEY ("suggestedBiomarkerDefinitionId") REFERENCES "BiomarkerDefinition" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LabExtractionItem_finalBiomarkerDefinitionId_fkey" FOREIGN KEY ("finalBiomarkerDefinitionId") REFERENCES "BiomarkerDefinition" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "entryDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "JournalObservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "journalEntryId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "normalizedValue" TEXT,
    "confidence" REAL,
    "source" TEXT NOT NULL DEFAULT 'AI_EXTRACTED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JournalObservation_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SUPPORTING',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'ON_TRACK',
    "progress" INTEGER,
    "startDate" DATETIME,
    "targetDate" DATETIME,
    "parentGoalId" TEXT,
    "bodySystems" JSONB NOT NULL DEFAULT [],
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Goal_parentGoalId_fkey" FOREIGN KEY ("parentGoalId") REFERENCES "Goal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HealthExperiment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExperimentOutcome" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "experimentId" TEXT NOT NULL,
    "metricType" TEXT NOT NULL,
    "metricReference" TEXT,
    "label" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExperimentOutcome_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "HealthExperiment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MedicalHistory_profileId_idx" ON "MedicalHistory"("profileId");

-- CreateIndex
CREATE INDEX "Medication_profileId_idx" ON "Medication"("profileId");

-- CreateIndex
CREATE INDEX "Supplement_profileId_idx" ON "Supplement"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "BiomarkerDefinition_canonicalKey_key" ON "BiomarkerDefinition"("canonicalKey");

-- CreateIndex
CREATE INDEX "BiomarkerDefinition_bodySystem_idx" ON "BiomarkerDefinition"("bodySystem");

-- CreateIndex
CREATE INDEX "BiomarkerMeasurement_biomarkerDefinitionId_measuredAt_idx" ON "BiomarkerMeasurement"("biomarkerDefinitionId", "measuredAt");

-- CreateIndex
CREATE INDEX "LabExtractionSession_documentId_idx" ON "LabExtractionSession"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "LabExtractionItem_resultingMeasurementId_key" ON "LabExtractionItem"("resultingMeasurementId");

-- CreateIndex
CREATE INDEX "LabExtractionItem_extractionSessionId_idx" ON "LabExtractionItem"("extractionSessionId");

-- CreateIndex
CREATE INDEX "JournalEntry_entryDate_idx" ON "JournalEntry"("entryDate");

-- CreateIndex
CREATE INDEX "JournalObservation_journalEntryId_idx" ON "JournalObservation"("journalEntryId");

-- CreateIndex
CREATE INDEX "Goal_parentGoalId_idx" ON "Goal"("parentGoalId");

-- CreateIndex
CREATE INDEX "ExperimentOutcome_experimentId_idx" ON "ExperimentOutcome"("experimentId");
