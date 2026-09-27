-- CreateTable
CREATE TABLE "NormalizedHealthEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "confidence" REAL,
    "metadata" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "HealthInsight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fingerprint" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "confidenceLevel" TEXT NOT NULL,
    "confidenceScore" INTEGER NOT NULL,
    "primarySystem" TEXT,
    "secondarySystem" TEXT,
    "firstObservedAt" DATETIME NOT NULL,
    "lastObservedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "dismissedAt" DATETIME,
    "metadata" JSONB NOT NULL
);

-- CreateTable
CREATE TABLE "InsightEvidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "insightId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "observedAt" DATETIME,
    "numericValue" REAL,
    "metadata" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InsightEvidence_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "HealthInsight" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "NormalizedHealthEvent_type_occurredAt_idx" ON "NormalizedHealthEvent"("type", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "NormalizedHealthEvent_sourceType_sourceId_type_key" ON "NormalizedHealthEvent"("sourceType", "sourceId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "HealthInsight_fingerprint_key" ON "HealthInsight"("fingerprint");

-- CreateIndex
CREATE INDEX "HealthInsight_status_idx" ON "HealthInsight"("status");

-- CreateIndex
CREATE INDEX "HealthInsight_primarySystem_idx" ON "HealthInsight"("primarySystem");

-- CreateIndex
CREATE INDEX "InsightEvidence_insightId_idx" ON "InsightEvidence"("insightId");
