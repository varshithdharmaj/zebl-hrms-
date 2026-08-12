import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  emptyRecruitmentScope,
  unrestrictedRecruitmentScope,
  type RecruitmentScope,
} from "@/lib/recruitment/types/scope";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    application: {
      count: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    candidate: { count: vi.fn() },
    interview: { count: vi.fn() },
    offer: { count: vi.fn() },
    jobOpening: { count: vi.fn() },
    employeeConversionSnapshot: { count: vi.fn(), findMany: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  buildScopeFilter,
  prismaAnalyticsRepository,
} from "@/lib/recruitment/repositories/analytics-repository";

function assignedScope(partial?: Partial<RecruitmentScope>): RecruitmentScope {
  return {
    ...emptyRecruitmentScope(),
    ...partial,
    mode: "assigned",
  };
}

describe("buildScopeFilter (P0-3 analytics unrestricted scope)", () => {
  it("Test 1 — unrestricted scope omits empty IN predicates", () => {
    const filter = buildScopeFilter(unrestrictedRecruitmentScope());

    expect(filter).toEqual({});
    expect(filter).not.toHaveProperty("OR");
    expect(JSON.stringify(filter)).not.toContain('"in":[]');
  });

  it("Test 2 — restricted scope applies application/candidate/job OR", () => {
    const filter = buildScopeFilter(
      assignedScope({
        applicationIds: ["app-a"],
        candidateIds: ["cand-a"],
        jobOpeningIds: ["job-b"],
      })
    );

    expect(filter).toEqual({
      OR: [
        { id: { in: ["app-a"] } },
        { candidateId: { in: ["cand-a"] } },
        { jobOpeningId: { in: ["job-b"] } },
      ],
    });
  });

  it("Test 3 — empty assigned scope keeps IN [] (does NOT become unrestricted)", () => {
    const filter = buildScopeFilter(emptyRecruitmentScope());

    expect(filter).toEqual({
      OR: [
        { id: { in: [] } },
        { candidateId: { in: [] } },
        { jobOpeningId: { in: [] } },
      ],
    });
    expect(filter).not.toEqual({});
  });
});

describe("prismaAnalyticsRepository scope wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.application.count).mockResolvedValue(0);
    vi.mocked(prisma.application.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.application.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.candidate.count).mockResolvedValue(0);
    vi.mocked(prisma.interview.count).mockResolvedValue(0);
    vi.mocked(prisma.offer.count).mockResolvedValue(0);
    vi.mocked(prisma.jobOpening.count).mockResolvedValue(0);
    vi.mocked(prisma.employeeConversionSnapshot.count).mockResolvedValue(0);
    vi.mocked(prisma.employeeConversionSnapshot.findMany).mockResolvedValue([] as never);
  });

  it("Test 4 — unrestricted KPIs/funnel/pipeline do not pass empty IN scope", async () => {
    const scope = unrestrictedRecruitmentScope();
    vi.mocked(prisma.application.count).mockResolvedValue(42);

    await prismaAnalyticsRepository.getExecutiveKPIs({ scope });
    await prismaAnalyticsRepository.getHiringFunnel({ scope });
    await prismaAnalyticsRepository.getPipelineMetrics({ scope });

    const appCountCalls = vi.mocked(prisma.application.count).mock.calls;
    expect(appCountCalls.length).toBeGreaterThan(0);

    for (const [args] of appCountCalls) {
      const where = args?.where as Record<string, unknown> | undefined;
      expect(where).toBeDefined();
      expect(where).not.toHaveProperty("OR");
      expect(JSON.stringify(where)).not.toMatch(/"in"\s*:\s*\[\s*\]/);
    }

    const groupArgs = vi.mocked(prisma.application.groupBy).mock.calls[0]?.[0] as
      | { where?: Record<string, unknown> }
      | undefined;
    expect(groupArgs?.where).toBeDefined();
    expect(groupArgs?.where).not.toHaveProperty("OR");
  });

  it("Test 5 — unrestricted application where matches list-repo empty scope", async () => {
    expect(buildScopeFilter(unrestrictedRecruitmentScope())).toEqual({});

    vi.mocked(prisma.application.count).mockResolvedValue(17);
    const kpis = await prismaAnalyticsRepository.getExecutiveKPIs({
      scope: unrestrictedRecruitmentScope(),
    });
    expect(kpis.totalApplications).toBe(17);

    const totalAppsWhere = vi.mocked(prisma.application.count).mock.calls[0]?.[0]?.where;
    expect(totalAppsWhere).toEqual({ deletedAt: null });
  });

  it("restricted empty scope still forces zero via IN [] on application queries", async () => {
    vi.mocked(prisma.application.count).mockResolvedValue(0);

    await prismaAnalyticsRepository.getHiringFunnel({
      scope: emptyRecruitmentScope(),
    });

    const appCall = vi
      .mocked(prisma.application.count)
      .mock.calls.find(([args]) => args?.where && "OR" in (args.where as object));

    expect(appCall?.[0]?.where).toMatchObject({
      deletedAt: null,
      OR: [
        { id: { in: [] } },
        { candidateId: { in: [] } },
        { jobOpeningId: { in: [] } },
      ],
    });
  });
});
