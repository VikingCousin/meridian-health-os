import { prisma } from "@/lib/db/prisma";
import type { NormalizedEventType, Prisma } from "@/lib/generated/prisma/client";

export async function upsertNormalizedEvent(data: Prisma.NormalizedHealthEventCreateInput) {
  return prisma.normalizedHealthEvent.upsert({
    where: {
      sourceType_sourceId_type: {
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        type: data.type,
      },
    },
    create: data,
    // Re-running normalization must be idempotent, not silently stale — a
    // corrected journal observation should update the event it produced.
    update: {
      occurredAt: data.occurredAt,
      endedAt: data.endedAt,
      confidence: data.confidence,
      metadata: data.metadata,
    },
  });
}

export async function listEventsByType(type: NormalizedEventType, since?: Date) {
  return prisma.normalizedHealthEvent.findMany({
    where: { type, ...(since ? { occurredAt: { gte: since } } : {}) },
    orderBy: { occurredAt: "asc" },
  });
}

export async function listAllEvents(since?: Date) {
  return prisma.normalizedHealthEvent.findMany({
    where: since ? { occurredAt: { gte: since } } : undefined,
    orderBy: { occurredAt: "asc" },
  });
}

export async function findEventsOnDate(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return prisma.normalizedHealthEvent.findMany({
    where: { occurredAt: { gte: start, lt: end } },
  });
}
