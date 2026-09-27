import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

const SINGLETON_ID = "singleton";

export async function getSettings() {
  return prisma.appSettings.findUnique({ where: { id: SINGLETON_ID } });
}

export async function upsertSettings(data: Partial<Omit<Prisma.AppSettingsCreateInput, "id">>) {
  return prisma.appSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...data },
    update: data,
  });
}
