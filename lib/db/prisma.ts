import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// Prisma 7 requires an explicit driver adapter — there's no more implicit
// query-engine-binary connection from just a schema `url`.
const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./data/app.db" });

// Standard Next.js dev-mode singleton: without this, every hot reload of a
// module that imports this file would open a fresh SQLite connection.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
