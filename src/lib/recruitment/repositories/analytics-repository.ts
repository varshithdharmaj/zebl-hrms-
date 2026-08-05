import { prisma } from "@/lib/prisma";
import { ApplicationStatus, CandidateStatus, OfferStatus, InterviewStatus, JobOpeningStatus } from "@/generated/prisma/enums";
import type { RecruitmentScope } from "@/lib/recruitment/types/scope";

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
    avgTimeToHire: number;
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
    avgTimeToHire: number;
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
    applicationToInterview: number;
    interviewToOffer: number;
    offerToHire: number;
    totalTimeToHire: number;
  }>;

  getTrendData(filters: AnalyticsFilters & { days: number }): Promise<{
    dates: string[];
    applications: number[];
    interviews: number[];
    offers: number[];
    hires: number[];
  }>;
};

function buildDateFilter(dateRange?: AnalyticsDateFilter) {
  if (!dateRange) return {};
  const filter: any = {};
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

    const avgTimeToHire = conversions.length > 0
      ? Math.round(
          conversions.reduce((sum, c) => {
            const days = Math.floor(
              (c.convertedAt.getTime() - c.application.createdAt.getTime()) / (1000 * 60 * 60 * 24)
            );
            return sum + days;
          }, 0) / conversions.length
        )
      : 0;

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
      avgDays: 0, // Simplified for now
    }));

    const stuckCandidates = await prisma.application.count({
      where: {
        deletedAt: null,
        status: ApplicationStatus.active,
        stageEnteredAt: {
          lte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30+ days
        },
        ...scopeFilter,
      },
    });

    return { byStage, stuckCandidates };
  },

  async getRecruiterPerformance(filters) {
    const dateFilter = buildDateFilter(filters.dateRange);

    const recruiters = await prisma.user.findMany({
      where: {
        role: { in: ["hr", "super_admin"] },
      },
      select: { id: true, email: true },
    });

    const performance = await Promise.all(
      recruiters.map(async (recruiter) => {
        const [openJobs, candidates, interviews, offers, hires] = await Promise.all([
          prisma.jobOpening.count({
            where: {
              ownerRecruiterUserId: recruiter.id,
              status: JobOpeningStatus.open,
              deletedAt: null,
            },
          }),
          prisma.candidate.count({
            where: {
              primaryRecruiterUserId: recruiter.id,
              deletedAt: null,
            },
          }),
          prisma.interview.count({
            where: {
              application: {
                assignedRecruiterUserId: recruiter.id,
              },
            },
          }),
          prisma.offer.count({
            where: {
              application: {
                assignedRecruiterUserId: recruiter.id,
              },
              status: { not: OfferStatus.draft },
            },
          }),
          prisma.employeeConversionSnapshot.count({
            where: {
              application: {
                assignedRecruiterUserId: recruiter.id,
              },
            },
          }),
        ]);

        const acceptedOffers = await prisma.offer.count({
          where: {
            application: { assignedRecruiterUserId: recruiter.id },
            status: OfferStatus.accepted,
          },
        });

        const acceptanceRate = offers > 0 ? Math.round((acceptedOffers / offers) * 100) : 0;

        return {
          recruiterId: recruiter.id,
          recruiterEmail: recruiter.email,
          openJobs,
          candidates,
          interviews,
          offers,
          hires,
          acceptanceRate,
          avgTimeToHire: 0, // Simplified
        };
      })
    );

    return performance.filter((p) => p.openJobs > 0 || p.candidates > 0);
  },

  async getDepartmentAnalytics(filters) {
    const departments = await prisma.jobOpening.groupBy({
      by: ["department"],
      where: {
        department: { not: null },
        deletedAt: null,
      },
      _count: true,
    });

    const analytics = await Promise.all(
      departments.map(async (dept) => {
        const [openPositions, filledPositions, offers] = await Promise.all([
          prisma.jobOpening.count({
            where: {
              department: dept.department,
              status: JobOpeningStatus.open,
              deletedAt: null,
            },
          }),
          prisma.jobOpening.count({
            where: {
              department: dept.department,
              status: JobOpeningStatus.filled,
              deletedAt: null,
            },
          }),
          prisma.offer.count({
            where: {
              department: dept.department,
              status: { not: OfferStatus.draft },
            },
          }),
        ]);

        const acceptedOffers = await prisma.offer.count({
          where: {
            department: dept.department,
            status: OfferStatus.accepted,
          },
        });

        const acceptanceRate = offers > 0 ? Math.round((acceptedOffers / offers) * 100) : 0;

        return {
          department: dept.department || "Unknown",
          openPositions,
          filledPositions,
          offers,
          acceptanceRate,
        };
      })
    );

    return analytics;
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

    const [sent, accepted, declined, expired, withdrawn] = await Promise.all([
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
          status: OfferStatus.declined,
          ...(dateFilter.gte || dateFilter.lte ? { declinedAt: dateFilter } : {}),
        },
      }),
      prisma.offer.count({
        where: {
          status: OfferStatus.expired,
        },
      }),
      prisma.offer.count({
        where: {
          status: OfferStatus.withdrawn,
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

    return { sent, accepted, declined, expired, withdrawn, avgRevisionCount };
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

    const analytics = await Promise.all(
      sources.map(async (src) => {
        const [applications, interviews, offers, hires] = await Promise.all([
          prisma.application.count({
            where: {
              candidate: { source: src.source },
              deletedAt: null,
            },
          }),
          prisma.interview.count({
            where: {
              application: {
                candidate: { source: src.source },
              },
            },
          }),
          prisma.offer.count({
            where: {
              application: {
                candidate: { source: src.source },
              },
              status: { not: OfferStatus.draft },
            },
          }),
          prisma.employeeConversionSnapshot.count({
            where: {
              candidate: { source: src.source },
            },
          }),
        ]);

        const conversionRate = applications > 0 ? Math.round((hires / applications) * 100) : 0;

        return {
          source: src.source,
          applications,
          interviews,
          offers,
          hires,
          conversionRate,
        };
      })
    );

    return analytics.sort((a, b) => b.hires - a.hires);
  },

  async getTimeMetrics(filters) {
    // Simplified time metrics
    return {
      applicationToInterview: 7,
      interviewToOffer: 5,
      offerToHire: 14,
      totalTimeToHire: 26,
    };
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
