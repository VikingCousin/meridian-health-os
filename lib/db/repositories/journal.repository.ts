import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

export async function listJournalEntries() {
  return prisma.journalEntry.findMany({
    orderBy: { entryDate: "desc" },
    include: { observations: true },
  });
}

export async function findJournalEntry(id: string) {
  return prisma.journalEntry.findUnique({
    where: { id },
    include: { observations: true },
  });
}

export async function createJournalEntry(
  data: Prisma.JournalEntryCreateInput,
  observations: Omit<Prisma.JournalObservationCreateManyInput, "journalEntryId">[]
) {
  return prisma.journalEntry.create({
    data: {
      ...data,
      observations: { create: observations },
    },
    include: { observations: true },
  });
}
