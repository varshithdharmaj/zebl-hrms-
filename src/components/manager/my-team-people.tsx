import Link from "next/link";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import type { MyTeamPeopleListResult } from "@/lib/manager/team-people-query";

export function MyTeamPeopleSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-10 w-64 rounded-lg" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export function MyTeamPeopleView({
  data,
  search,
}: {
  data: MyTeamPeopleListResult;
  search: string;
}) {
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const q = search.trim();

  function pageHref(page: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return qs ? `/employee/team/people?${qs}` : "/employee/team/people";
  }

  return (
    <div className="space-y-8">
      <WorkspacePageHeader
        title="People"
        description="Your direct reports."
        badge={
          <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-foreground">
            {data.total} {data.total === 1 ? "person" : "people"}
          </span>
        }
      />

      <form method="get" className="flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search name, code, department…"
          className="h-10 min-w-[16rem] flex-1 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Search team members"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      <SectionCard noPadding>
        {data.total === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">
              {q ? "No matching team members" : "You don’t have any active team members"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {q
                ? "Try a different search."
                : "Direct reports assigned to you will appear here."}
            </p>
          </div>
        ) : (
          <>
            <DataTable columns={["Name", "Code", "Department", "Designation", "Status", ""]}>
              {data.items.map((person) => (
                <DataTableRow key={person.id}>
                  <DataTableCell className="font-medium text-foreground">
                    {person.name}
                  </DataTableCell>
                  <DataTableCell className="text-muted-foreground">
                    {person.employeeCode}
                  </DataTableCell>
                  <DataTableCell>{person.department ?? "—"}</DataTableCell>
                  <DataTableCell>{person.designation ?? "—"}</DataTableCell>
                  <DataTableCell>{person.employeeStatus}</DataTableCell>
                  <DataTableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/employee/team/people/${person.id}`}>View</Link>
                    </Button>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTable>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
                <p className="text-muted-foreground">
                  Page {data.page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={pageHref(Math.max(1, data.page - 1))}
                      aria-disabled={data.page <= 1}
                      className={data.page <= 1 ? "pointer-events-none opacity-50" : undefined}
                    >
                      Previous
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={pageHref(Math.min(totalPages, data.page + 1))}
                      aria-disabled={data.page >= totalPages}
                      className={
                        data.page >= totalPages ? "pointer-events-none opacity-50" : undefined
                      }
                    >
                      Next
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </SectionCard>
    </div>
  );
}
