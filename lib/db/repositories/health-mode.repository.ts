import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

export async function listActiveHealthModes() {
  return prisma.healthMode.findMany({ where: { status: "ACTIVE" }, orderBy: { startedAt: "desc" } });
}

export async function listHealthModes() {
  return prisma.healthMode.findMany({ orderBy: { startedAt: "desc" } });
}

export async function createHealthMode(data: Prisma.HealthModeCreateInput) {
  return prisma.healthMode.create({ data });
}

export async function updateHealthMode(id: string, data: Prisma.HealthModeUpdateInput) {
  return prisma.healthMode.update({ where: { id }, data });
}
