-- CreateTable
CREATE TABLE "HealthKnowledgeDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceName" TEXT,
    "topic" TEXT,
    "bodySystem" TEXT,
    "contentHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "metadata" JSONB NOT NULL
);

-- CreateTable
CREATE TABLE "HealthKnowledgeChunk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "heading" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "keywords" JSONB NOT NULL DEFAULT [],
    "bodySystem" TEXT,
    "topic" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HealthKnowledgeChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "HealthKnowledgeDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "demoMode" BOOLEAN NOT NULL DEFAULT true,
    "externalAiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "HealthKnowledgeDocument_contentHash_key" ON "HealthKnowledgeDocument"("contentHash");

-- CreateIndex
CREATE INDEX "HealthKnowledgeDocument_bodySystem_idx" ON "HealthKnowledgeDocument"("bodySystem");

-- CreateIndex
CREATE INDEX "HealthKnowledgeDocument_topic_idx" ON "HealthKnowledgeDocument"("topic");

-- CreateIndex
CREATE INDEX "HealthKnowledgeChunk_documentId_idx" ON "HealthKnowledgeChunk"("documentId");

-- CreateIndex
CREATE INDEX "HealthKnowledgeChunk_bodySystem_idx" ON "HealthKnowledgeChunk"("bodySystem");

-- CreateIndex
CREATE INDEX "HealthKnowledgeChunk_topic_idx" ON "HealthKnowledgeChunk"("topic");
