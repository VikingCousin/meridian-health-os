import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

export async function listExperiments() {
  return prisma.healthExperiment.findMany({
    orderBy: { startDate: "desc" },
    include: { outcomes: true },
  });
}

export async function findExperiment(id: string) {
  return prisma.healthExperiment.findUnique({
    where: { id },
    include: { outcomes: true },
  });
}

export async function createExperiment(
  data: Prisma.HealthExperimentCreateInput,
  outcomes: Omit<Prisma.ExperimentOutcomeCreateManyInput, "experimentId">[]
) {
  return prisma.healthExperiment.create({
    data: {
      ...data,
      outcomes: { create: outcomes },
    },
    include: { outcomes: true },
  });
}

export async function updateExperiment(id: string, data: Prisma.HealthExperimentUpdateInput) {
  return prisma.healthExperiment.update({ where: { id }, data });
}
