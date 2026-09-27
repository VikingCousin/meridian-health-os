import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

export async function listCoachPriorities() {
  return prisma.coachPriority.findMany({ orderBy: { createdAt: "desc" } });
}

export async function listActiveCoachPriorities() {
  return prisma.coachPriority.findMany({
    where: { status: { in: ["ACCEPTED", "ACTIVE"] } },
    orderBy: { rank: "asc" },
  });
}

export async function findCoachPriority(id: string) {
  return prisma.coachPriority.findUnique({ where: { id } });
}

export async function findActiveByIntervention(interventionDefinitionId: string) {
  return prisma.coachPriority.findFirst({
    where: { interventionDefinitionId, status: { in: ["ACCEPTED", "ACTIVE"] } },
  });
}

export async function createCoachPriority(data: Prisma.CoachPriorityCreateInput) {
  return prisma.coachPriority.create({ data });
}

export async function updateCoachPriority(id: string, data: Prisma.CoachPriorityUpdateInput) {
  return prisma.coachPriority.update({ where: { id }, data });
}
