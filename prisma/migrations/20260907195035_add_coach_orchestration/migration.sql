-- AlterTable
ALTER TABLE "Goal" ADD COLUMN "rationale" TEXT;
ALTER TABLE "Goal" ADD COLUMN "successCriteria" TEXT;
ALTER TABLE "Goal" ADD COLUMN "timeHorizon" TEXT;

-- CreateTable
CREATE TABLE "HealthMode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "targetEndAt" DATETIME,
    "priorityModifier" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CoachPriority" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "interventionDefinitionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUGGESTED',
    "score" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "linkedGoalIds" JSONB NOT NULL,
    "linkedInsightIds" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
