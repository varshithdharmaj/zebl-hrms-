import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * Run work in a Prisma interactive transaction.
 * Prefer this over ad-hoc $transaction calls in recruitment services.
 */
export async function withRecruitmentTransaction<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: {
    maxWait?: number;
    timeout?: number;
  }
): Promise<T> {
  return prisma.$transaction(work, {
    maxWait: options?.maxWait ?? 10_000,
    timeout: options?.timeout ?? 30_000,
  });
}
