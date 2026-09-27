import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

// Single-user app: always operate on the first (and only) profile row.
export async function findProfile() {
  return prisma.userProfile.findFirst({
    orderBy: { createdAt: "asc" },
  });
}

export async function createProfile(data: Prisma.UserProfileCreateInput) {
  return prisma.userProfile.create({ data });
}

export async function updateProfile(id: string, data: Prisma.UserProfileUpdateInput) {
  return prisma.userProfile.update({ where: { id }, data });
}
