import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

export async function listDocuments() {
  return prisma.healthDocument.findMany({
    orderBy: [{ documentDate: "desc" }, { createdAt: "desc" }],
  });
}

export async function findDocumentById(id: string) {
  return prisma.healthDocument.findUnique({ where: { id } });
}

export async function createDocument(data: Prisma.HealthDocumentCreateInput) {
  return prisma.healthDocument.create({ data });
}

export async function updateDocument(id: string, data: Prisma.HealthDocumentUpdateInput) {
  return prisma.healthDocument.update({ where: { id }, data });
}
