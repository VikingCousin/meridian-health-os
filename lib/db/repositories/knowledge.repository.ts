import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

export async function findDocumentByHash(contentHash: string) {
  return prisma.healthKnowledgeDocument.findUnique({ where: { contentHash } });
}

export async function createDocumentWithChunks(
  document: Prisma.HealthKnowledgeDocumentCreateInput,
  chunks: Omit<Prisma.HealthKnowledgeChunkCreateManyInput, "documentId">[]
) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.healthKnowledgeDocument.create({ data: document });
    if (chunks.length > 0) {
      await tx.healthKnowledgeChunk.createMany({
        data: chunks.map((c) => ({ ...c, documentId: created.id })),
      });
    }
    return created;
  });
}

export async function listDocuments() {
  return prisma.healthKnowledgeDocument.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { chunks: true } } },
  });
}

export async function findDocumentWithChunks(id: string) {
  return prisma.healthKnowledgeDocument.findUnique({
    where: { id },
    include: { chunks: { orderBy: { order: "asc" } } },
  });
}

export async function deleteDocument(id: string) {
  return prisma.healthKnowledgeDocument.delete({ where: { id } });
}

export async function listAllChunksWithDocument() {
  return prisma.healthKnowledgeChunk.findMany({
    include: { document: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function countDocuments() {
  return prisma.healthKnowledgeDocument.count();
}
