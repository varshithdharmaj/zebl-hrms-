import { cache } from "react";
import type { SessionUser } from "@/lib/session";
import { createApplicationService } from "@/lib/recruitment/services/application-service";
import { normalizePagination } from "@/lib/recruitment/shared/pagination";

export const getApplicationCached = cache(async (session: SessionUser, applicationId: string) => {
  const service = createApplicationService();
  return service.getApplication(session, applicationId);
});

export const listApplicationsCached = cache(
  async (
    session: SessionUser,
    filters: unknown,
    pagination: { page: number; pageSize: number },
    sort?: { field: string; direction: "asc" | "desc" },
    options?: { maxPageSize?: number }
  ) => {
    const service = createApplicationService();
    return service.listApplications(session, {
      filters,
      pagination: normalizePagination(pagination, { maxPageSize: options?.maxPageSize }),
      sort,
    });
  }
);

export const getDashboardMetricsCached = cache(
  async (session: SessionUser, filters?: any) => {
    const service = createApplicationService();
    return service.getDashboardMetrics(session, filters);
  }
);
