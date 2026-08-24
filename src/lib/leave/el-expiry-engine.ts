import { prisma } from "@/lib/prisma";

export type ElExpiryResult = {
  lotsExpired: number;
  amountExpired: number;
};

/**
 * Expires the unused remainder of every EL lot whose expiryDate has passed.
 * Naturally idempotent: a lot with remaining=0 (already expired or fully
 * consumed) is excluded by the `remaining: { gt: 0 }` filter, so re-running
 * this on the same lot twice is a no-op the second time.
 */
export async function runElExpiryBatch(asOf: Date = new Date()): Promise<ElExpiryResult> {
  const lots = await prisma.elAccrualLot.findMany({
    where: { expiryDate: { lte: asOf }, remaining: { gt: 0 } },
    select: { id: true, employeeId: true, remaining: true },
  });

  let lotsExpired = 0;
  let amountExpired = 0;

  for (const lot of lots) {
    try {
      const expired = await prisma.$transaction(async (tx) => {
        // Conditional update guards against a concurrent consumption/expiry
        // changing `remaining` between the read above and this write.
        const updated = await tx.elAccrualLot.updateMany({
          where: { id: lot.id, remaining: { gt: 0 } },
          data: { remaining: 0 },
        });
        if (updated.count === 0) return false;

        await tx.leaveTransaction.create({
          data: {
            employeeId: lot.employeeId,
            leaveType: "EL",
            transactionType: "expiry",
            amount: lot.remaining,
            reason: `EL lot expired`,
            createdBy: "system",
            elAccrualLotId: lot.id,
          },
        });

        await tx.employeeLeaveBalance.update({
          where: { employeeId: lot.employeeId },
          data: { elBalance: { decrement: lot.remaining } },
        });
        return true;
      });

      if (expired) {
        lotsExpired += 1;
        amountExpired += lot.remaining;
      }
    } catch (error) {
      console.error(`[leave] EL expiry failed for lot ${lot.id}:`, error);
    }
  }

  return { lotsExpired, amountExpired };
}
