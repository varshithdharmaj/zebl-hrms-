import Link from "next/link";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { JobOpeningsFilters, jobListHref } from "@/components/recruitment/jobs/job-openings-filters";
import { JobOpeningsTable } from "@/components/recruitment/jobs/job-openings-table";
import { Button } from "@/components/ui/button";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { listJobOpeningsCached } from "@/lib/recruitment/job/queries";
import { jobOpeningListFiltersSchema } from "@/lib/validation/schemas/recruitment/jobs";
import { JobOpeningStatus } from "@/generated/prisma/enums";
import type { JobOpeningSortField } from "@/lib/recruitment/job/types";

export default async function RecruitmentJobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireHROrSuperAdminSession();
  const raw = await searchParams;

  const parsed = jobOpeningListFiltersSchema.safeParse({
    q: typeof raw.q === "string" ? raw.q : undefined,
    status: typeof raw.status === "string" ? raw.status : "all",
    department: typeof raw.department === "string" ? raw.department : undefined,
    includeArchived: raw.includeArchived === "true",
    page: typeof raw.page === "string" ? raw.page : "1",
    pageSize: "25",
    sort: typeof raw.sort === "string" ? raw.sort : "createdAt",
    direction: typeof raw.direction === "string" ? raw.direction : "desc",
  });

  const filters = parsed.success
    ? parsed.data
    : {
        q: undefined,
        status: "all" as const,
        department: undefined,
        includeArchived: false,
        page: 1,
        pageSize: 25,
        sort: "createdAt" as const,
        direction: "desc" as const,
      };

  const statusFilter =
    filters.status === "all"
      ? "all"
      : (filters.status as JobOpeningStatus);

  const result = await listJobOpeningsCached(
    session,
    {
      q: filters.q,
      status: statusFilter,
      department: filters.department,
      includeArchived: filters.includeArchived,
    },
    { page: filters.page, pageSize: filters.pageSize },
    {
      field: filters.sort as JobOpeningSortField,
      direction: filters.direction,
    }
  );

  const filterState = {
    q: filters.q,
    status: filters.status,
    department: filters.department,
    includeArchived: filters.includeArchived,
    sort: filters.sort,
    direction: filters.direction,
    page: filters.page,
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Job Openings"
        description="Create and manage roles, hiring teams, and headcount."
        action={
          <Button asChild>
            <Link href="/admin/recruitment/jobs/new">New job opening</Link>
          </Button>
        }
      />

      <JobOpeningsFilters filters={filterState} />

      <JobOpeningsTable jobs={result.items} />

      {result.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {result.page > 1 && (
            <Link
              href={jobListHref(filterState, result.page - 1)}
              className="rounded-md border bg-background px-4 py-2 text-sm hover:bg-muted"
            >
              Previous
            </Link>
          )}
          <span className="px-4 py-2 text-sm text-muted-foreground">
            Page {result.page} of {result.totalPages} · {result.total} jobs
          </span>
          {result.page < result.totalPages && (
            <Link
              href={jobListHref(filterState, result.page + 1)}
              className="rounded-md border bg-background px-4 py-2 text-sm hover:bg-muted"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
