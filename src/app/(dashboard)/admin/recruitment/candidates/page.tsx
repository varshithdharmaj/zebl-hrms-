import Link from "next/link";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { CandidateFilters } from "@/components/recruitment/candidates/candidate-filters";
import { CandidateTable } from "@/components/recruitment/candidates/candidate-table";
import { Button } from "@/components/ui/button";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { listCandidatesCached, getEmployeeOptions } from "@/lib/recruitment/candidate";
import { candidateListHref } from "@/lib/recruitment/candidate/list-href";
import { candidateListFiltersSchema } from "@/lib/validation/schemas/recruitment";
import { CandidateStatus, CandidateSource } from "@/generated/prisma/enums";

export default async function RecruitmentCandidatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireHROrSuperAdminSession();
  const raw = await searchParams;

  const parsed = candidateListFiltersSchema.safeParse({
    q: typeof raw.q === "string" ? raw.q : undefined,
    status: typeof raw.status === "string" ? raw.status : "all",
    source: typeof raw.source === "string" ? raw.source : "all",
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
        source: "all" as const,
        includeArchived: false,
        page: 1,
        pageSize: 25,
        sort: "createdAt" as const,
        direction: "desc" as const,
      };

  const statusFilter =
    filters.status === "all"
      ? "all"
      : (filters.status as CandidateStatus);

  const sourceFilter =
    filters.source === "all"
      ? "all"
      : (filters.source as CandidateSource);

  const result = await listCandidatesCached(
    session,
    {
      q: filters.q,
      status: statusFilter,
      source: sourceFilter,
      includeArchived: filters.includeArchived,
    },
    { page: filters.page, pageSize: filters.pageSize },
    {
      field: filters.sort,
      direction: filters.direction,
    }
  );

  const employeeOptions = await getEmployeeOptions();

  const filterState = {
    q: filters.q,
    status: filters.status,
    source: filters.source,
    includeArchived: filters.includeArchived,
    sort: filters.sort,
    direction: filters.direction,
    page: filters.page,
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Candidates"
        description="Track and manage candidate profiles, resumes, and recruitment history."
        action={
          <Button asChild>
            <Link href="/admin/recruitment/candidates/new">Add Candidate</Link>
          </Button>
        }
      />

      <CandidateFilters filters={filterState} />

      <CandidateTable candidates={result.items} employeeOptions={employeeOptions} />

      {result.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {result.page > 1 && (
            <Link
              href={candidateListHref(filterState, result.page - 1)}
              className="rounded-md border bg-background px-4 py-2 text-sm hover:bg-muted"
            >
              Previous
            </Link>
          )}
          <span className="px-4 py-2 text-sm text-muted-foreground">
            Page {result.page} of {result.totalPages} · {result.total} candidates
          </span>
          {result.page < result.totalPages && (
            <Link
              href={candidateListHref(filterState, result.page + 1)}
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
