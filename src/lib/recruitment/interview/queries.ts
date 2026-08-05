import { cache } from "react";
import type { SessionUser } from "@/lib/session";
import { createInterviewService } from "@/lib/recruitment/services/interview-service";
import { normalizePagination } from "@/lib/recruitment/shared/pagination";

export const getInterviewCached = cache(async (session: SessionUser, interviewId: string) => {
  const service = createInterviewService();
  return service.getInterview(session, interviewId);
});

export const listInterviewsCached = cache(
  async (
    session: SessionUser,
    filters: any,
    pagination: { page: number; pageSize: number },
    sort?: { field: string; direction: "asc" | "desc" }
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
  async (session: SessionUser, filters?: any) => {
    const service = createInterviewService();
    return service.getDashboardMetrics(session, filters);
  }
);
