import Link from "next/link";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { OfferFilters } from "@/components/recruitment/offers/offer-filters";
import { OfferTable } from "@/components/recruitment/offers/offer-table";
import { OfferEmptyState } from "@/components/recruitment/offers/offer-empty-state";
import { Button } from "@/components/ui/button";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { listOffersCached } from "@/lib/recruitment/offer/queries";
import { offerListHref } from "@/lib/recruitment/offer/list-href";
import { offerListFiltersSchema } from "@/lib/validation/schemas/recruitment";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { Plus } from "lucide-react";

export default async function RecruitmentOffersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireHROrSuperAdminSession();
  const raw = await searchParams;

  const parsed = offerListFiltersSchema.safeParse({
    q: typeof raw.q === "string" ? raw.q : undefined,
    status: typeof raw.status === "string" ? raw.status : "all",
    jobOpeningId: typeof raw.jobOpeningId === "string" ? raw.jobOpeningId : "all",
    recruiterUserId: typeof raw.recruiterUserId === "string" ? raw.recruiterUserId : "all",
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
        jobOpeningId: "all",
        recruiterUserId: "all",
        page: 1,
        pageSize: 25,
        sort: "createdAt" as const,
        direction: "desc" as const,
      };

  const [result, jobs, recruiters] = await Promise.all([
    listOffersCached(
      session,
      {
        q: filters.q,
        status: filters.status,
        jobOpeningId: filters.jobOpeningId,
        recruiterUserId: filters.recruiterUserId,
      },
      { page: filters.page, pageSize: filters.pageSize },
      { field: filters.sort, direction: filters.direction }
    ),
    prisma.jobOpening.findMany({
      where: { deletedAt: null },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
      take: 200,
    }),
    prisma.user.findMany({
      where: { role: { in: [UserRole.hr, UserRole.super_admin] } },
      select: { id: true, email: true },
      orderBy: { email: "asc" },
      take: 100,
    }),
  ]);

  const filterState = {
    q: filters.q,
    status: filters.status,
    jobOpeningId: filters.jobOpeningId,
    recruiterUserId: filters.recruiterUserId,
    sort: filters.sort,
    direction: filters.direction,
    page: filters.page,
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Offers"
        description="Track draft, sent, accepted, and closed offer letters."
        action={
          <Button asChild size="sm" className="font-semibold text-xs rounded-lg gap-1.5 shadow-subtle">
            <Link href="/admin/recruitment/offers/new">
              <Plus className="h-4 w-4" /> Create Offer
            </Link>
          </Button>
        }
      />

      <OfferFilters filters={filterState} jobs={jobs} recruiters={recruiters} />

      {result.items.length === 0 ? (
        <OfferEmptyState />
      ) : (
        <OfferTable offers={result.items} />
      )}

      {result.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {result.page > 1 && (
            <Link
              href={offerListHref(filterState, result.page - 1)}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted/20"
            >
              Previous
            </Link>
          )}
          <span className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
            Page {result.page} of {result.totalPages}
          </span>
          {result.page < result.totalPages && (
            <Link
              href={offerListHref(filterState, result.page + 1)}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted/20"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
