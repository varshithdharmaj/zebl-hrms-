import { prisma } from "@/lib/prisma";

/** The currently-active human-readable leave policy document, if any. Read-only content — never parsed by business logic. */
export async function getActiveLeavePolicyDocument() {
  return prisma.leavePolicyDocument.findFirst({
    where: { isActive: true },
    orderBy: { effectiveFrom: "desc" },
  });
}
