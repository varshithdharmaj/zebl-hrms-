import { cache } from "react";
import type { SessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { createInterviewService } from "@/lib/recruitment/services/interview-service";
import { normalizePagination } from "@/lib/recruitment/shared/pagination";
import type { InterviewListFilters } from "@/lib/recruitment/repositories/interview-repository";
import type { SearchFilters, SortOptions } from "@/lib/recruitment/types/pagination";

/** True when the employee is on at least one interview panel. */
export const hasPanelistInterviewAssignment = cache(
  async (employeeId: number | null | undefined): Promise<boolean> => {
    if (employeeId == null) return false;
    const row = await prisma.interviewPanelist.findFirst({
      where: { employeeId },
      select: { id: true },
    });
    return row != null;
  }
);

export const getInterviewCached = cache(async (session: SessionUser, interviewId: string) => {
  const service = createInterviewService();
  return service.getInterview(session, interviewId);
});

export const listInterviewsCached = cache(
  async (
    session: SessionUser,
    filters: InterviewListFilters | SearchFilters | undefined,
    pagination: { page: number; pageSize: number },
    sort?: SortOptions
  ) => {
    const service = createInterviewService();
    return service.listInterviews(session, {
      filters,
      pagination: normalizePagination(pagination),
      sort,
    });
  }
);

export const getInterviewDashboardMetricsCached = cache(
  async (session: SessionUser, filters?: InterviewListFilters | SearchFilters) => {
    const service = createInterviewService();
    return service.getDashboardMetrics(session, filters);
  }
);
