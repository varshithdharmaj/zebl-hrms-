import { cache } from "react";
import type { SessionUser } from "@/lib/session";
import { JobOpeningService } from "@/lib/recruitment/job/job-opening-service";
import type { JobOpeningListFilters, JobOpeningSort } from "@/lib/recruitment/job/types";
import { prisma } from "@/lib/prisma";
import { normalizePagination } from "@/lib/recruitment/shared/pagination";

export const getJobOpeningCached = cache(async (session: SessionUser, jobId: string) => {
  return JobOpeningService.get(session, jobId);
});

export const listJobOpeningsCached = cache(
  async (
    session: SessionUser,
    filters: JobOpeningListFilters,
    pagination: { page: number; pageSize: number },
    sort: JobOpeningSort
  ) => {
    return JobOpeningService.list(session, {
      filters,
      pagination: normalizePagination(pagination),
      sort,
    });
  }
);

export const getJobDashboardCountsCached = cache(async (session: SessionUser) => {
  return JobOpeningService.count(session);
});

export const listActivePipelineTemplatesCached = cache(async () => {
  return prisma.recruitmentPipelineTemplate.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, name: true, isSystem: true },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });
});

export const listEmployeeOptionsCached = cache(async () => {
  return prisma.employee.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      employeeCode: true,
      department: true,
      user: { select: { id: true, email: true } },
    },
    orderBy: { name: "asc" },
    take: 500,
  });
});
