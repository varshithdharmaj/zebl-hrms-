import { prisma } from "@/lib/prisma";
import {
  ApplicationStatus,
  CandidateSource,
  CandidateStatus,
  OfferStatus,
  InterviewStatus,
  JobOpeningStatus,
} from "@/generated/prisma/enums";
import type { RecruitmentScope } from "@/lib/recruitment/types/scope";
import { computeTimeToHireMetrics } from "@/lib/recruitment/analytics/compute-time-to-hire";

export type AnalyticsDateFilter = {
  startDate?: Date;
  endDate?: Date;
};

export type AnalyticsFilters = {
  dateRange?: AnalyticsDateFilter;
  department?: string;
  recruiterUserId?: string;
  jobOpeningId?: string;
  location?: string;
  employmentType?: string;
  source?: string;
  scope: RecruitmentScope;
};

export type AnalyticsRepository = {
  getExecutiveKPIs(filters: AnalyticsFilters): Promise<{
    totalOpenJobs: number;
    activeCandidates: number;
    totalApplications: number;
    totalInterviews: number;
    offersSent: number;
    offersAccepted: number;
    pendingConversions: number;
    employeesJoined: number;
    avgTimeToHire: number | null;
    offerAcceptanceRate: number;
    conversionRate: number;
  }>;

  getHiringFunnel(filters: AnalyticsFilters): Promise<{
    candidates: number;
    applications: number;
    interviews: number;
    offers: number;
    accepted: number;
    employees: number;
  }>;

  getPipelineMetrics(filters: AnalyticsFilters): Promise<{
    byStage: Array<{ stage: string; count: number; avgDays: number }>;
    stuckCandidates: number;
  }>;

  getRecruiterPerformance(filters: AnalyticsFilters): Promise<Array<{
    recruiterId: string;
    recruiterEmail: string;
    openJobs: number;
    candidates: number;
    interviews: number;
    offers: number;
    hires: number;
    acceptanceRate: number;
    avgTimeToHire: number | null;
  }>>;

  getDepartmentAnalytics(filters: AnalyticsFilters): Promise<Array<{
    department: string;
    openPositions: number;
    filledPositions: number;
    offers: number;
    acceptanceRate: number;
  }>>;

  getInterviewAnalytics(filters: AnalyticsFilters): Promise<{
    upcoming: number;
    completed: number;
    cancelled: number;
    noShow: number;
    avgFeedbackScore: number;
  }>;

  getOfferAnalytics(filters: AnalyticsFilters): Promise<{
    draft?: number;
    sent: number;
    accepted: number;
    declined: number;
    expired: number;
    withdrawn: number;
    avgRevisionCount: number;
  }>;

  getSourceAnalytics(filters: AnalyticsFilters): Promise<Array<{
    source: string;
    applications: number;
    interviews: number;
    offers: number;
    hires: number;
    conversionRate: number;
  }>>;

  getTimeMetrics(filters: AnalyticsFilters): Promise<{
    applicationToInterview: number | null;
    interviewToOffer: number | null;
    offerToHire: number | null;
    totalTimeToHire: number | null;
    sampleSize: number;
  }>;

  getTrendData(filters: AnalyticsFilters & { days: number }): Promise<{
    dates: string[];
    applications: number[];
    interviews: number[];
    offers: number[];
    hires: number[];
  }>;
};

function buildDateFilter(dateRange?: AnalyticsDateFilter): {
  gte?: Date;
  lte?: Date;
} {
  if (!dateRange) return {};
  const filter: { gte?: Date; lte?: Date } = {};
  if (dateRange.startDate) filter.gte = dateRange.startDate;
  if (dateRange.endDate) filter.lte = dateRange.endDate;
  return filter;
}

function buildScopeFilter(scope: RecruitmentScope) {
  return {
    OR: [
      { id: { in: [...scope.applicationIds] } },
      { candidateId: { in: [...scope.candidateIds] } },
      { jobOpeningId: { in: [...scope.jobOpeningIds] } },
    ],
  };
}

export const prismaAnalyticsRepository: AnalyticsRepository = {
  async getExecutiveKPIs(filters) {
    const dateFilter = buildDateFilter(filters.dateRange);
    const scopeFilter = buildScopeFilter(filters.scope);

    const [
      totalOpenJobs,
      activeCandidates,
      totalApplications,
      totalInterviews,
      offersSent,
      offersAccepted,
      pendingConversions,
      employeesJoined,
    ] = await Promise.all([
      prisma.jobOpening.count({
        where: {
          status: JobOpeningStatus.open,
          deletedAt: null,
          ...(filters.department ? { department: filters.department } : {}),
        },
      }),
      prisma.candidate.count({
        where: {
          status: CandidateStatus.active,
          deletedAt: null,
          ...(dateFilter.gte || dateFilter.lte ? { createdAt: dateFilter } : {}),
        },
      }),
      prisma.application.count({
        where: {
          deletedAt: null,
          ...(dateFilter.gte || dateFilter.lte ? { createdAt: dateFilter } : {}),
          ...scopeFilter,
        },
      }),
      prisma.interview.count({
        where: {
          deletedAt: null,
          ...(dateFilter.gte || dateFilter.lte ? { scheduledStart: dateFilter } : {}),
        },
      }),
      prisma.offer.count({
        where: {
          status: { not: OfferStatus.draft },
          ...(dateFilter.gte || dateFilter.lte ? { sentAt: dateFilter } : {}),
        },
      }),
      prisma.offer.count({
        where: {
          status: OfferStatus.accepted,
          ...(dateFilter.gte || dateFilter.lte ? { acceptedAt: dateFilter } : {}),
        },
      }),
      prisma.offer.count({
        where: {
          status: OfferStatus.accepted,
          conversionSnapshot: null,
        },
      }),
      prisma.employeeConversionSnapshot.count({
        where: {
          ...(dateFilter.gte || dateFilter.lte ? { convertedAt: dateFilter } : {}),
        },
      }),
    ]);

    const offerAcceptanceRate = offersSent > 0 ? Math.round((offersAccepted / offersSent) * 100) : 0;
    const conversionRate = offersAccepted > 0 ? Math.round((employeesJoined / offersAccepted) * 100) : 0;

    // Calculate average time to hire
    const conversions = await prisma.employeeConversionSnapshot.findMany({
      where: {
        ...(dateFilter.gte || dateFilter.lte ? { convertedAt: dateFilter } : {}),
      },
      select: {
        convertedAt: true,
        application: {
          select: { createdAt: true },
        },
      },
      take: 100,
    });

    const avgTimeToHire =
      conversions.length > 0
        ? Math.round(
            conversions.reduce((sum, c) => {
              const days = Math.floor(
                (c.convertedAt.getTime() - c.application.createdAt.getTime()) /
                  (1000 * 60 * 60 * 24)
              );
              return sum + Math.max(0, days);
            }, 0) / conversions.length
          )
        : null;

    return {
      totalOpenJobs,
      activeCandidates,
      totalApplications,
      totalInterviews,
      offersSent,
      offersAccepted,
      pendingConversions,
      employeesJoined,
      avgTimeToHire,
      offerAcceptanceRate,
      conversionRate,
    };
  },

  async getHiringFunnel(filters) {
    const dateFilter = buildDateFilter(filters.dateRange);
    const scopeFilter = buildScopeFilter(filters.scope);

    const [candidates, applications, interviews, offers, accepted, employees] = await Promise.all([
      prisma.candidate.count({
        where: {
          deletedAt: null,
          ...(dateFilter.gte || dateFilter.lte ? { createdAt: dateFilter } : {}),
        },
      }),
      prisma.application.count({
        where: {
          deletedAt: null,
          ...(dateFilter.gte || dateFilter.lte ? { createdAt: dateFilter } : {}),
          ...scopeFilter,
        },
      }),
      prisma.interview.count({
        where: {
          deletedAt: null,
          ...(dateFilter.gte || dateFilter.lte ? { scheduledStart: dateFilter } : {}),
        },
      }),
      prisma.offer.count({
        where: {
          status: { not: OfferStatus.draft },
          ...(dateFilter.gte || dateFilter.lte ? { sentAt: dateFilter } : {}),
        },
      }),
      prisma.offer.count({
        where: {
          status: OfferStatus.accepted,
          ...(dateFilter.gte || dateFilter.lte ? { acceptedAt: dateFilter } : {}),
        },
      }),
      prisma.employeeConversionSnapshot.count({
        where: {
          ...(dateFilter.gte || dateFilter.lte ? { convertedAt: dateFilter } : {}),
        },
      }),
    ]);

    return { candidates, applications, interviews, offers, accepted, employees };
  },

  async getPipelineMetrics(filters) {
    const dateFilter = buildDateFilter(filters.dateRange);
    const scopeFilter = buildScopeFilter(filters.scope);

    const applicationsByStage = await prisma.application.groupBy({
      by: ["currentStage"],
      where: {
        deletedAt: null,
        status: ApplicationStatus.active,
        ...scopeFilter,
      },
      _count: true,
    });

    const byStage = applicationsByStage.map((item) => ({
      stage: item.currentStage,
      count: item._count,
      /** Current-stage dwell only (now − stageEnteredAt); not historical avg. */
      avgDays: 0,
    }));

    // Real dwell time in current stage — one query, aggregate in memory by stage
    const activeApps = await prisma.application.findMany({
      where: {
        deletedAt: null,
        status: ApplicationStatus.active,
        ...scopeFilter,
      },
      select: { currentStage: true, stageEnteredAt: true },
    });

    const dwell: Record<string, { totalDays: number; count: number }> = {};
    const now = Date.now();
    for (const app of activeApps) {
      if (!app.stageEnteredAt) continue;
      const days = (now - app.stageEnteredAt.getTime()) / (1000 * 60 * 60 * 24);
      const bucket = dwell[app.currentStage] ?? { totalDays: 0, count: 0 };
      bucket.totalDays += days;
      bucket.count += 1;
      dwell[app.currentStage] = bucket;
    }

    const byStageWithDwell = byStage.map((row) => {
      const stats = dwell[row.stage];
      return {
        ...row,
        avgDays: stats && stats.count > 0 ? Math.round((stats.totalDays / stats.count) * 10) / 10 : 0,
      };
    });

    const stuckCandidates = await prisma.application.count({
      where: {
        deletedAt: null,
        status: ApplicationStatus.active,
        stageEnteredAt: {
          lte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
        ...scopeFilter,
      },
    });

    return { byStage: byStageWithDwell, stuckCandidates };
  },

  async getRecruiterPerformance(filters) {
    const dateFilter = buildDateFilter(filters.dateRange);

    const recruiters = await prisma.user.findMany({
      where: {
        role: { in: ["hr", "super_admin"] },
      },
      select: { id: true, email: true },
    });

    if (recruiters.length === 0) return [];

    const recruiterIds = recruiters.map((r) => r.id);

    const [appsByRecruiter, interviewsByApp, offersByApp, conversions] = await Promise.all([
      prisma.application.groupBy({
        by: ["assignedRecruiterUserId"],
        where: {
          deletedAt: null,
          assignedRecruiterUserId: { in: recruiterIds },
          ...(dateFilter.gte || dateFilter.lte ? { createdAt: dateFilter } : {}),
        },
        _count: { id: true },
      }),
      prisma.interview.groupBy({
        by: ["applicationId"],
        where: {
          deletedAt: null,
          application: {
            assignedRecruiterUserId: { in: recruiterIds },
            deletedAt: null,
          },
          ...(dateFilter.gte || dateFilter.lte ? { scheduledStart: dateFilter } : {}),
        },
        _count: { id: true },
      }),
      prisma.offer.groupBy({
        by: ["applicationId"],
        where: {
          application: {
            assignedRecruiterUserId: { in: recruiterIds },
            deletedAt: null,
          },
          status: { not: OfferStatus.draft },
          ...(dateFilter.gte || dateFilter.lte ? { sentAt: dateFilter } : {}),
        },
        _count: { id: true },
        _max: { status: true },
      }),
      prisma.employeeConversionSnapshot.findMany({
        where: {
          ...(dateFilter.gte || dateFilter.lte ? { convertedAt: dateFilter } : {}),
          application: {
            assignedRecruiterUserId: { in: recruiterIds },
          },
        },
        select: {
          convertedAt: true,
          application: {
            select: {
              createdAt: true,
              assignedRecruiterUserId: true,
              id: true,
            },
          },
        },
      }),
    ]);

    // Resolve application → recruiter for interview/offer counts
    const appIds = [
      ...new Set([
        ...interviewsByApp.map((r) => r.applicationId),
        ...offersByApp.map((r) => r.applicationId),
      ]),
    ];
    const appRecruiters =
      appIds.length === 0
        ? []
        : await prisma.application.findMany({
            where: { id: { in: appIds } },
            select: { id: true, assignedRecruiterUserId: true },
          });
    const appToRecruiter = new Map(
      appRecruiters.map((a) => [a.id, a.assignedRecruiterUserId])
    );

    const interviewCountByRecruiter = new Map<string, number>();
    for (const row of interviewsByApp) {
      const rid = appToRecruiter.get(row.applicationId);
      if (!rid) continue;
      interviewCountByRecruiter.set(
        rid,
        (interviewCountByRecruiter.get(rid) ?? 0) + row._count.id
      );
    }

    const offerCountByRecruiter = new Map<string, number>();
    for (const row of offersByApp) {
      const rid = appToRecruiter.get(row.applicationId);
      if (!rid) continue;
      offerCountByRecruiter.set(rid, (offerCountByRecruiter.get(rid) ?? 0) + row._count.id);
    }

    // Accepted offers for acceptance rate — one query
    const acceptedOffers = await prisma.offer.findMany({
      where: {
        status: OfferStatus.accepted,
        application: {
          assignedRecruiterUserId: { in: recruiterIds },
          deletedAt: null,
        },
      },
      select: {
        applicationId: true,
        application: { select: { assignedRecruiterUserId: true } },
      },
    });
    const acceptedByRecruiter = new Map<string, number>();
    for (const o of acceptedOffers) {
      const rid = o.application.assignedRecruiterUserId;
      if (!rid) continue;
      acceptedByRecruiter.set(rid, (acceptedByRecruiter.get(rid) ?? 0) + 1);
    }

    const tthByRecruiter = new Map<string, { totalDays: number; count: number }>();
    for (const c of conversions) {
      const rid = c.application.assignedRecruiterUserId;
      if (!rid) continue;
      const days = Math.floor(
        (c.convertedAt.getTime() - c.application.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      const bucket = tthByRecruiter.get(rid) ?? { totalDays: 0, count: 0 };
      bucket.totalDays += Math.max(0, days);
      bucket.count += 1;
      tthByRecruiter.set(rid, bucket);
    }

    const hiresByRecruiter = new Map<string, number>();
    for (const c of conversions) {
      const rid = c.application.assignedRecruiterUserId;
      if (!rid) continue;
      hiresByRecruiter.set(rid, (hiresByRecruiter.get(rid) ?? 0) + 1);
    }

    const candidatesByRecruiter = new Map(
      appsByRecruiter
        .filter((r) => r.assignedRecruiterUserId)
        .map((r) => [r.assignedRecruiterUserId!, r._count.id])
    );

    // Open jobs owned by recruiter — single groupBy
    const openJobsGrouped = await prisma.jobOpening.groupBy({
      by: ["ownerRecruiterUserId"],
      where: {
        status: JobOpeningStatus.open,
        deletedAt: null,
        ownerRecruiterUserId: { in: recruiterIds },
      },
      _count: { id: true },
    });
    const openJobsByUser = new Map(
      openJobsGrouped
        .filter((r) => r.ownerRecruiterUserId)
        .map((r) => [r.ownerRecruiterUserId!, r._count.id])
    );

    return recruiters
      .map((recruiter) => {
        const candidates = candidatesByRecruiter.get(recruiter.id) ?? 0;
        const interviews = interviewCountByRecruiter.get(recruiter.id) ?? 0;
        const offers = offerCountByRecruiter.get(recruiter.id) ?? 0;
        const accepted = acceptedByRecruiter.get(recruiter.id) ?? 0;
        const hires = hiresByRecruiter.get(recruiter.id) ?? 0;
        const tth = tthByRecruiter.get(recruiter.id);
        const openJobs = openJobsByUser.get(recruiter.id) ?? 0;
        const acceptanceRate = offers > 0 ? Math.round((accepted / offers) * 100) : 0;
        const avgTimeToHire =
          tth && tth.count > 0 ? Math.round(tth.totalDays / tth.count) : null;

        return {
          recruiterId: recruiter.id,
          recruiterEmail: recruiter.email,
          openJobs,
          candidates,
          interviews,
          offers,
          hires,
          acceptanceRate,
          avgTimeToHire,
        };
      })
      .filter((p) => p.openJobs > 0 || p.candidates > 0 || p.hires > 0 || p.offers > 0);
  },

  async getDepartmentAnalytics(filters) {
    const dateFilter = buildDateFilter(filters.dateRange);

    const [openByDept, filledByDept, offersByDept, acceptedByDept] = await Promise.all([
      prisma.jobOpening.groupBy({
        by: ["department"],
        where: {
          department: { not: null },
          deletedAt: null,
          status: JobOpeningStatus.open,
          ...(filters.department ? { department: filters.department } : {}),
        },
        _count: { id: true },
      }),
      prisma.jobOpening.groupBy({
        by: ["department"],
        where: {
          department: { not: null },
          deletedAt: null,
          status: JobOpeningStatus.filled,
          ...(filters.department ? { department: filters.department } : {}),
        },
        _count: { id: true },
      }),
      prisma.offer.groupBy({
        by: ["department"],
        where: {
          department: { not: null },
          status: { not: OfferStatus.draft },
          ...(filters.department ? { department: filters.department } : {}),
          ...(dateFilter.gte || dateFilter.lte ? { sentAt: dateFilter } : {}),
        },
        _count: { id: true },
      }),
      prisma.offer.groupBy({
        by: ["department"],
        where: {
          department: { not: null },
          status: OfferStatus.accepted,
          ...(filters.department ? { department: filters.department } : {}),
          ...(dateFilter.gte || dateFilter.lte ? { acceptedAt: dateFilter } : {}),
        },
        _count: { id: true },
      }),
    ]);

    const deptSet = new Set<string>();
    for (const row of [...openByDept, ...filledByDept, ...offersByDept, ...acceptedByDept]) {
      if (row.department) deptSet.add(row.department);
    }

    const openMap = new Map(openByDept.map((r) => [r.department!, r._count.id]));
    const filledMap = new Map(filledByDept.map((r) => [r.department!, r._count.id]));
    const offerMap = new Map(offersByDept.map((r) => [r.department!, r._count.id]));
    const acceptedMap = new Map(acceptedByDept.map((r) => [r.department!, r._count.id]));

    return [...deptSet]
      .sort()
      .map((department) => {
        const offers = offerMap.get(department) ?? 0;
        const accepted = acceptedMap.get(department) ?? 0;
        return {
          department,
          openPositions: openMap.get(department) ?? 0,
          filledPositions: filledMap.get(department) ?? 0,
          offers,
          acceptanceRate: offers > 0 ? Math.round((accepted / offers) * 100) : 0,
        };
      });
  },

  async getInterviewAnalytics(filters) {
    const dateFilter = buildDateFilter(filters.dateRange);

    const now = new Date();
    const [upcoming, completed, cancelled, noShow] = await Promise.all([
      prisma.interview.count({
        where: {
          scheduledStart: { gte: now },
          status: InterviewStatus.scheduled,
          deletedAt: null,
        },
      }),
      prisma.interview.count({
        where: {
          status: InterviewStatus.completed,
          deletedAt: null,
          ...(dateFilter.gte || dateFilter.lte ? { updatedAt: dateFilter } : {}),
        },
      }),
      prisma.interview.count({
        where: {
          status: InterviewStatus.cancelled,
          ...(dateFilter.gte || dateFilter.lte ? { updatedAt: dateFilter } : {}),
        },
      }),
      prisma.interview.count({
        where: {
          status: InterviewStatus.no_show,
          ...(dateFilter.gte || dateFilter.lte ? { updatedAt: dateFilter } : {}),
        },
      }),
    ]);

    const feedbackData = await prisma.interviewFeedback.aggregate({
      _avg: { overallRating: true },
      where: {
        ...(dateFilter.gte || dateFilter.lte ? { createdAt: dateFilter } : {}),
      },
    });

    const avgFeedbackScore = feedbackData._avg.overallRating
      ? Math.round(feedbackData._avg.overallRating * 10) / 10
      : 0;

    return { upcoming, completed, cancelled, noShow, avgFeedbackScore };
  },

  async getOfferAnalytics(filters) {
    const dateFilter = buildDateFilter(filters.dateRange);
    const now = new Date();

    const [draft, sent, accepted, declined, withdrawn, expiredReleased, expiredNoted] =
      await Promise.all([
        prisma.offer.count({
          where: {
            status: OfferStatus.draft,
            ...(dateFilter.gte || dateFilter.lte ? { createdAt: dateFilter } : {}),
          },
        }),
        prisma.offer.count({
          where: {
            status: OfferStatus.released,
            OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
            ...(dateFilter.gte || dateFilter.lte ? { sentAt: dateFilter } : {}),
          },
        }),
        prisma.offer.count({
          where: {
            status: OfferStatus.accepted,
            ...(dateFilter.gte || dateFilter.lte ? { acceptedAt: dateFilter } : {}),
          },
        }),
        prisma.offer.count({
          where: {
            status: OfferStatus.declined,
            NOT: { offerNotes: { contains: "Offer Expired" } },
            ...(dateFilter.gte || dateFilter.lte ? { declinedAt: dateFilter } : {}),
          },
        }),
        prisma.offer.count({
          where: {
            status: OfferStatus.withdrawn,
            ...(dateFilter.gte || dateFilter.lte ? { withdrawnAt: dateFilter } : {}),
          },
        }),
        prisma.offer.count({
          where: {
            status: OfferStatus.released,
            expiresAt: { lt: now },
          },
        }),
        prisma.offer.count({
          where: {
            status: OfferStatus.declined,
            offerNotes: { contains: "Offer Expired" },
          },
        }),
      ]);

    const revisionsData = await prisma.offerRevision.groupBy({
      by: ["offerId"],
      _count: true,
    });

    const avgRevisionCount =
      revisionsData.length > 0
        ? Math.round(
            (revisionsData.reduce((sum, r) => sum + r._count, 0) / revisionsData.length) * 10
          ) / 10
        : 0;

    return {
      draft,
      sent,
      accepted,
      declined,
      expired: expiredReleased + expiredNoted,
      withdrawn,
      avgRevisionCount,
    };
  },

  async getSourceAnalytics(filters) {
    const dateFilter = buildDateFilter(filters.dateRange);

    const sources = await prisma.candidate.groupBy({
      by: ["source"],
      where: {
        deletedAt: null,
        ...(dateFilter.gte || dateFilter.lte ? { createdAt: dateFilter } : {}),
      },
      _count: true,
    });

    if (sources.length === 0) return [];

    const sourceValues = sources
      .map((s) => s.source)
      .filter((s): s is CandidateSource => s != null);

    if (sourceValues.length === 0) {
      return sources.map((src) => ({
        source: src.source ?? "unknown",
        applications: 0,
        interviews: 0,
        offers: 0,
        hires: 0,
        conversionRate: 0,
      }));
    }

    const [applications, interviewApps, offerRows, hireRows] = await Promise.all([
      prisma.application.groupBy({
        by: ["source"],
        where: {
          deletedAt: null,
          source: { in: sourceValues },
        },
        _count: true,
      }),
      prisma.application.findMany({
        where: {
          deletedAt: null,
          source: { in: sourceValues },
          interviews: { some: { deletedAt: null } },
        },
        select: {
          source: true,
          _count: { select: { interviews: true } },
        },
      }),
      prisma.offer.findMany({
        where: {
          status: { not: OfferStatus.draft },
          application: { source: { in: sourceValues }, deletedAt: null },
        },
        select: { application: { select: { source: true } } },
      }),
      prisma.employeeConversionSnapshot.findMany({
        where: {
          candidate: { source: { in: sourceValues } },
        },
        select: { candidate: { select: { source: true } } },
      }),
    ]);

    const interviewCountBySource = new Map<string, number>();
    for (const app of interviewApps) {
      if (!app.source) continue;
      interviewCountBySource.set(
        app.source,
        (interviewCountBySource.get(app.source) ?? 0) + app._count.interviews
      );
    }

    const offerCountBySource = new Map<string, number>();
    for (const o of offerRows) {
      const src = o.application.source;
      if (!src) continue;
      offerCountBySource.set(src, (offerCountBySource.get(src) ?? 0) + 1);
    }

    const hireCountBySource = new Map<string, number>();
    for (const h of hireRows) {
      const src = h.candidate.source;
      if (!src) continue;
      hireCountBySource.set(src, (hireCountBySource.get(src) ?? 0) + 1);
    }

    const appCountBySource = new Map(
      applications.filter((a) => a.source).map((a) => [a.source!, a._count])
    );

    return sources
      .map((src) => {
        const source = src.source ?? "unknown";
        const apps = appCountBySource.get(source) ?? 0;
        const hireCount = hireCountBySource.get(source) ?? 0;
        return {
          source,
          applications: apps,
          interviews: interviewCountBySource.get(source) ?? 0,
          offers: offerCountBySource.get(source) ?? 0,
          hires: hireCount,
          conversionRate: apps > 0 ? Math.round((hireCount / apps) * 100) : 0,
        };
      })
      .sort((a, b) => b.hires - a.hires);
  },

  async getTimeMetrics(filters) {
    const dateFilter = buildDateFilter(filters.dateRange);

    const conversions = await prisma.employeeConversionSnapshot.findMany({
      where: {
        ...(dateFilter.gte || dateFilter.lte ? { convertedAt: dateFilter } : {}),
      },
      select: {
        convertedAt: true,
        applicationId: true,
        application: {
          select: { createdAt: true },
        },
        offer: {
          select: {
            acceptedAt: true,
            sentAt: true,
            releasedAt: true,
          },
        },
      },
    });

    if (conversions.length === 0) {
      return computeTimeToHireMetrics([]);
    }

    const appIds = conversions.map((c) => c.applicationId);
    const firstInterviews = await prisma.interview.groupBy({
      by: ["applicationId"],
      where: {
        applicationId: { in: appIds },
        deletedAt: null,
        scheduledStart: { not: null },
      },
      _min: { scheduledStart: true },
    });
    const interviewByApp = new Map(
      firstInterviews.map((row) => [row.applicationId, row._min.scheduledStart])
    );

    return computeTimeToHireMetrics(
      conversions.map((c) => ({
        applicationCreatedAt: c.application.createdAt,
        convertedAt: c.convertedAt,
        firstInterviewAt: interviewByApp.get(c.applicationId) ?? null,
        offerSentAt: c.offer.sentAt ?? c.offer.releasedAt ?? null,
        offerAcceptedAt: c.offer.acceptedAt ?? null,
      }))
    );
  },

  async getTrendData(filters) {
    const { days } = filters;
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const dates: string[] = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      dates.push(date.toISOString().split("T")[0] ?? "");
    }

    const emptyBuckets = () => Object.fromEntries(dates.map((d) => [d, 0])) as Record<string, number>;
    const appBuckets = emptyBuckets();
    const interviewBuckets = emptyBuckets();
    const offerBuckets = emptyBuckets();
    const hireBuckets = emptyBuckets();

    const dayKey = (value: Date) => value.toISOString().split("T")[0] ?? "";

    const [appRows, interviewRows, offerRows, hireRows] = await Promise.all([
      prisma.application.findMany({
        where: {
          createdAt: { gte: startDate, lt: endDate },
          deletedAt: null,
        },
        select: { createdAt: true },
      }),
      prisma.interview.findMany({
        where: {
          scheduledStart: { gte: startDate, lt: endDate },
          deletedAt: null,
        },
        select: { scheduledStart: true },
      }),
      prisma.offer.findMany({
        where: { sentAt: { gte: startDate, lt: endDate } },
        select: { sentAt: true },
      }),
      prisma.employeeConversionSnapshot.findMany({
        where: { convertedAt: { gte: startDate, lt: endDate } },
        select: { convertedAt: true },
      }),
    ]);

    for (const row of appRows) {
      const key = dayKey(row.createdAt);
      if (key in appBuckets) appBuckets[key] += 1;
    }
    for (const row of interviewRows) {
      if (!row.scheduledStart) continue;
      const key = dayKey(row.scheduledStart);
      if (key in interviewBuckets) interviewBuckets[key] += 1;
    }
    for (const row of offerRows) {
      if (!row.sentAt) continue;
      const key = dayKey(row.sentAt);
      if (key in offerBuckets) offerBuckets[key] += 1;
    }
    for (const row of hireRows) {
      const key = dayKey(row.convertedAt);
      if (key in hireBuckets) hireBuckets[key] += 1;
    }

    return {
      dates,
      applications: dates.map((d) => appBuckets[d] ?? 0),
      interviews: dates.map((d) => interviewBuckets[d] ?? 0),
      offers: dates.map((d) => offerBuckets[d] ?? 0),
      hires: dates.map((d) => hireBuckets[d] ?? 0),
    };
  },
};
