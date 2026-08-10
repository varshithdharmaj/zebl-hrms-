import { beforeEach, describe, expect, it, vi } from "vitest";
import { HiringDecisionOutcome } from "@/generated/prisma/enums";

const findFirst = vi.fn();
const findMany = vi.fn();
const updateMany = vi.fn();
const aggregate = vi.fn();
const create = vi.fn();
const queryRaw = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    hiringDecision: {
      findFirst: (...args: unknown[]) => findFirst(...args),
      findMany: (...args: unknown[]) => findMany(...args),
      updateMany: (...args: unknown[]) => updateMany(...args),
      aggregate: (...args: unknown[]) => aggregate(...args),
      create: (...args: unknown[]) => create(...args),
    },
    $queryRaw: (...args: unknown[]) => queryRaw(...args),
  },
}));

import { prismaDecisionRepository } from "@/lib/recruitment/repositories/prisma-decision-repository";

const v1Row = {
  id: "dec-1",
  applicationId: "app-1",
  outcome: HiringDecisionOutcome.hire,
  rationale: "Fit for role",
  strengths: "Ownership",
  concerns: null,
  salaryRecommendation: null,
  currency: null,
  version: 1,
  isCurrent: true,
  decidedByUserId: "user-hr",
  decidedAt: new Date("2026-08-01T10:00:00.000Z"),
  createdAt: new Date("2026-08-01T10:00:00.000Z"),
  decidedBy: { id: "user-hr", email: "hr@example.com" },
};

function mockTx(overrides?: {
  maxVersion?: number | null;
  created?: Record<string, unknown>;
}) {
  return {
    $queryRaw: vi.fn(async () => [{ id: "app-1" }]),
    hiringDecision: {
      updateMany: vi.fn(async () => ({ count: overrides?.maxVersion ? 1 : 0 })),
      aggregate: vi.fn(async () => ({ _max: { version: overrides?.maxVersion ?? null } })),
      create: vi.fn(async () => overrides?.created ?? { ...v1Row }),
    },
  };
}

describe("prismaDecisionRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates first decision as version 1", async () => {
    const tx = mockTx({ maxVersion: null, created: { ...v1Row } });
    const result = await prismaDecisionRepository.appendDecision(
      {
        applicationId: "app-1",
        outcome: HiringDecisionOutcome.hire,
        rationale: "Fit for role",
        strengths: "Ownership",
        decidedByUserId: "user-hr",
      },
      tx as never
    );

    expect(result.version).toBe(1);
    expect(result.isCurrent).toBe(true);
    expect(tx.hiringDecision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          version: 1,
          isCurrent: true,
          rationale: "Fit for role",
        }),
      })
    );
  });

  it("creates second decision as version 2 and flips previous current", async () => {
    const created = {
      ...v1Row,
      id: "dec-2",
      outcome: HiringDecisionOutcome.strong_hire,
      rationale: "Updated after final round",
      strengths: "Leadership",
      version: 2,
      isCurrent: true,
    };
    const tx = mockTx({ maxVersion: 1, created });
    const result = await prismaDecisionRepository.appendDecision(
      {
        applicationId: "app-1",
        outcome: HiringDecisionOutcome.strong_hire,
        rationale: "Updated after final round",
        strengths: "Leadership",
        decidedByUserId: "user-hr",
      },
      tx as never
    );

    expect(result.version).toBe(2);
    expect(tx.hiringDecision.updateMany).toHaveBeenCalledWith({
      where: { applicationId: "app-1", isCurrent: true },
      data: { isCurrent: false },
    });
    expect(tx.hiringDecision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          version: 2,
          isCurrent: true,
          rationale: "Updated after final round",
        }),
      })
    );
  });

  it("findCurrent returns the current decision", async () => {
    findFirst.mockResolvedValue(v1Row);
    const current = await prismaDecisionRepository.findCurrent("app-1");
    expect(current?.id).toBe("dec-1");
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { applicationId: "app-1", isCurrent: true },
      })
    );
  });

  it("lists decisions descending by version", async () => {
    findMany.mockResolvedValue([
      { ...v1Row, id: "dec-2", version: 2 },
      v1Row,
    ]);
    const list = await prismaDecisionRepository.listByApplication("app-1");
    expect(list.map((row) => row.version)).toEqual([2, 1]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { applicationId: "app-1" },
        orderBy: { version: "desc" },
      })
    );
  });

  it("does not mutate historical content fields when appending", async () => {
    const tx = mockTx({
      maxVersion: 1,
      created: { ...v1Row, id: "dec-2", version: 2, rationale: "New rationale" },
    });
    await prismaDecisionRepository.appendDecision(
      {
        applicationId: "app-1",
        outcome: HiringDecisionOutcome.reject,
        rationale: "New rationale",
        strengths: "Still strong technically",
        decidedByUserId: "user-hr",
      },
      tx as never
    );

    expect(tx.hiringDecision.updateMany).toHaveBeenCalledWith({
      where: { applicationId: "app-1", isCurrent: true },
      data: { isCurrent: false },
    });
    const updateData = tx.hiringDecision.updateMany.mock.calls[0]?.[0]?.data as Record<
      string,
      unknown
    >;
    expect(updateData).not.toHaveProperty("rationale");
    expect(updateData).not.toHaveProperty("strengths");
    expect(updateData).not.toHaveProperty("outcome");
  });
});
