import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

export async function listInsights() {
  return prisma.healthInsight.findMany({ orderBy: { lastObservedAt: "desc" } });
}

export async function listActiveInsights() {
  return prisma.healthInsight.findMany({
    where: { status: { in: ["ACTIVE", "WATCHING"] } },
    orderBy: { lastObservedAt: "desc" },
  });
}

export async function findInsightById(id: string) {
  return prisma.healthInsight.findUnique({ where: { id }, include: { evidence: true } });
}

export async function findInsightByFingerprint(fingerprint: string) {
  return prisma.healthInsight.findUnique({ where: { fingerprint } });
}

export async function createInsight(data: Prisma.HealthInsightCreateInput) {
  return prisma.healthInsight.create({ data });
}

export async function updateInsight(id: string, data: Prisma.HealthInsightUpdateInput) {
  return prisma.healthInsight.update({ where: { id }, data });
}

export async function dismissInsight(id: string) {
  return prisma.healthInsight.update({ where: { id }, data: { status: "DISMISSED", dismissedAt: new Date() } });
}

export async function replaceEvidence(insightId: string, evidence: Omit<Prisma.InsightEvidenceCreateManyInput, "insightId">[]) {
  return prisma.$transaction([
    prisma.insightEvidence.deleteMany({ where: { insightId } }),
    prisma.insightEvidence.createMany({ data: evidence.map((e) => ({ ...e, insightId })) }),
  ]);
}
