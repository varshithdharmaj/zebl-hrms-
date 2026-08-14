import Link from "next/link";
import { Suspense } from "react";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { RecruitmentContextHeader } from "@/components/recruitment/shared/recruitment-context-header";
import { buildRecruitmentBreadcrumbs } from "@/lib/recruitment/navigation/breadcrumbs";
import { ApplicationFilters } from "@/components/recruitment/applications/application-filters";
import { ApplicationTable } from "@/components/recruitment/applications/application-table";
import { PipelineBoard } from "@/components/recruitment/applications/pipeline-board";
import { Button } from "@/components/ui/button";
import { requireRecruitmentAdminSession } from "@/lib/auth-guards";
import { getApplicationCached, listApplicationsCached } from "@/lib/recruitment/application";
import { getEmployeeOptions } from "@/lib/recruitment/candidate";
import { listInterviewsCached } from "@/lib/recruitment/interview/queries";
import {
  getCurrentHiringDecisionCached,
  getRequireDecisionForOfferCached,
} from "@/lib/recruitment/decision/queries";
import { prisma } from "@/lib/prisma";
import { ApplicationStatus, RecruitmentPipelineStage } from "@/generated/prisma/enums";
import {
  MAX_PAGE_SIZE,
  PIPELINE_BOARD_MAX_ITEMS,
  normalizePipelineBoardTake,
} from "@/lib/recruitment/shared/pagination";
import type { PipelineDrawerApplication } from "@/components/recruitment/applications/application-pipeline-drawer";
import {
  parseRecruitmentNavSearch,
  resolveRecruitmentReturnTo,
  returnToLabel,
} from "@/lib/recruitment/navigation/return-to";

export default async function RecruitmentPipelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRecruitmentAdminSession();
  const raw = await searchParams;
  const nav = parseRecruitmentNavSearch(raw);

  const view = raw.view === "list" ? "list" : "board";
  const applicationId = typeof raw.applicationId === "string" ? raw.applicationId : undefined;
  const boardPage = Math.max(1, Number(typeof raw.page === "string" ? raw.page : "1") || 1);
  const boardTake = normalizePipelineBoardTake(boardPage);

  const filters = {
    q: typeof raw.q === "string" ? raw.q : undefined,
    status: typeof raw.status === "string" ? raw.status : "all",
    currentStage: typeof raw.currentStage === "string" ? raw.currentStage : "all",
    jobOpeningId: typeof raw.jobOpeningId === "string" ? raw.jobOpeningId : "all",
    view: view as "board" | "list",
  };

  const statusFilter = filters.status === "all" ? undefined : (filters.status as ApplicationStatus);
  const stageFilter =
    filters.currentStage === "all"
      ? undefined
      : (filters.currentStage as RecruitmentPipelineStage);
  const jobFilter = filters.jobOpeningId === "all" ? undefined : filters.jobOpeningId;

  const listPagination =
    view === "board"
      ? { page: 1, pageSize: boardTake.take }
      : { page: 1, pageSize: MAX_PAGE_SIZE };

  const [
    result,
    employeeOptions,
    jobs,
    selectedDetail,
    selectedInterviews,
    selectedDecision,
    requireDecisionForOffer,
  ] = await Promise.all([
    listApplicationsCached(
      session,
      {
        q: filters.q,
        status: statusFilter,
        currentStage: stageFilter,
        jobOpeningId: jobFilter,
      },
      listPagination,
      { field: "createdAt", direction: "desc" },
      view === "board" ? { maxPageSize: PIPELINE_BOARD_MAX_ITEMS } : undefined
    ),
    getEmployeeOptions(),
    prisma.jobOpening.findMany({
      where: { deletedAt: null },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    applicationId ? getApplicationCached(session, applicationId).catch(() => null) : Promise.resolve(null),
    applicationId
      ? listInterviewsCached(session, { applicationId }, { page: 1, pageSize: 20 })
      : Promise.resolve({ items: [] as Record<string, unknown>[] }),
    applicationId
      ? getCurrentHiringDecisionCached(session, applicationId).catch(() => null)
      : Promise.resolve(null),
    getRequireDecisionForOfferCached(),
  ]);

  // Next.js cannot serialize Prisma Decimal objects from Server to Client Components.
  // We sanitize the result items, particularly candidate fields like totalExperienceYears.
  const safeResultItems = result.items.map((app: any) => ({
    ...app,
    candidate: app.candidate
      ? {
          ...app.candidate,
          totalExperienceYears:
            app.candidate.totalExperienceYears !== null && app.candidate.totalExperienceYears !== undefined
              ? Number(app.candidate.totalExperienceYears)
              : null,
          currentCtc: app.candidate.currentCtc !== null && app.candidate.currentCtc !== undefined ? Number(app.candidate.currentCtc) : null,
          expectedCtc: app.candidate.expectedCtc !== null && app.candidate.expectedCtc !== undefined ? Number(app.candidate.expectedCtc) : null,
        }
      : null,
  }));

  let selectedOffers: Array<{
    id: string;
    offerNumber: string | null;
    status: string;
    ctc: number | null;
  }> = [];
  if (applicationId) {
    const offers = await prisma.offer.findMany({
      where: { applicationId },
      orderBy: { createdAt: "desc" },
      select: { id: true, offerNumber: true, status: true, ctc: true },
    });
    selectedOffers = offers.map((o) => ({
      id: o.id,
      offerNumber: o.offerNumber,
      status: o.status,
      ctc: o.ctc == null ? null : Number(o.ctc),
    }));
  }

  const selectedApplication: PipelineDrawerApplication | null = selectedDetail
    ? {
        id: String(selectedDetail.id),
        currentStage: selectedDetail.currentStage as RecruitmentPipelineStage,
        status: String(selectedDetail.status),
        priority: (selectedDetail as { priority?: string | null }).priority ?? null,
        createdAt: selectedDetail.createdAt as Date | string,
        candidate: {
          id: String(selectedDetail.candidate?.id ?? ""),
          fullName: String(selectedDetail.candidate?.fullName ?? "Unknown"),
          email: selectedDetail.candidate?.email ?? null,
          phone: selectedDetail.candidate?.phone ?? null,
        },
        jobOpening: {
          id: String(selectedDetail.jobOpening?.id ?? ""),
          title: String(selectedDetail.jobOpening?.title ?? "Untitled"),
        },
        interviews: selectedInterviews.items.map((item) => ({
          id: String(item.id),
          title: String(item.title ?? "Interview"),
          scheduledStart: item.scheduledStart as Date | string,
          status: String(item.status ?? ""),
        })),
        offers: selectedOffers,
        stageHistory: Array.isArray(selectedDetail.stageHistory)
          ? selectedDetail.stageHistory.map((h: Record<string, unknown>) => ({
              id: String(h.id),
              toStage: (h.toStage as string | null) ?? null,
              fromStage: (h.fromStage as string | null) ?? null,
              createdAt: h.createdAt as Date | string,
            }))
          : [],
        assessment: (selectedDetail.assessment as string | null) ?? null,
        assessmentUpdatedAt:
          (selectedDetail.assessmentUpdatedAt as Date | string | null) ?? null,
        assessmentUpdatedByEmail:
          (
            selectedDetail as {
              assessmentUpdatedBy?: { email?: string | null } | null;
            }
          ).assessmentUpdatedBy?.email ?? null,
        currentDecision: selectedDecision,
        requireDecisionForOffer,
      }
    : null;

  const filteredJob = jobFilter ? jobs.find((job) => job.id === jobFilter) : undefined;

  return (
    <div className="space-y-6 lg:space-y-8">
      <RecruitmentContextHeader
        crumbs={buildRecruitmentBreadcrumbs({
          section: "pipeline",
          job: filteredJob ? { id: filteredJob.id, title: filteredJob.title } : null,
        })}
        stage={stageFilter}
      />
      <WorkspacePageHeader
        title="Pipeline"
        description="Move candidates through hiring stages. Interviews, offers, and Convert to Employee live on each card. Joined is for converted hires only."
        backHref={
          nav.returnTo
            ? resolveRecruitmentReturnTo(nav.returnTo, "/admin/recruitment/pipeline")
            : undefined
        }
        backLabel={nav.returnTo ? returnToLabel(nav.returnTo, "Back") : undefined}
        action={
          <Button asChild className="font-semibold shadow-subtle">
            <Link href="/admin/recruitment/applications/new">New Application</Link>
          </Button>
        }
      />

      <ApplicationFilters filters={filters} jobs={jobs} basePath="/admin/recruitment/pipeline" />

      {view === "board" ? (
        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading board…</div>}>
          <PipelineBoard
            applications={safeResultItems as PipelineDrawerApplication[]}
            employeeOptions={employeeOptions}
            selectedApplication={selectedApplication}
          />
          <div className="flex flex-col items-center gap-2 pt-2">
            <p className="text-xs text-muted-foreground">
              Showing {safeResultItems.length} of {result.total} applications
            </p>
            {boardTake.hasMoreCapacity && result.total > result.items.length ? (
              <Button asChild variant="outline" size="sm" className="font-semibold text-xs">
                <Link
                  href={`/admin/recruitment/pipeline?${new URLSearchParams({
                    ...(filters.q ? { q: filters.q } : {}),
                    ...(filters.status !== "all" ? { status: filters.status } : {}),
                    ...(filters.currentStage !== "all"
                      ? { currentStage: filters.currentStage }
                      : {}),
                    ...(filters.jobOpeningId !== "all"
                      ? { jobOpeningId: filters.jobOpeningId }
                      : {}),
                    view: "board",
                    page: String(boardPage + 1),
                    ...(applicationId ? { applicationId } : {}),
                  }).toString()}`}
                >
                  Load more
                </Link>
              </Button>
            ) : null}
          </div>
        </Suspense>
      ) : (
        <ApplicationTable applications={safeResultItems} employeeOptions={employeeOptions} />
      )}
    </div>
  );
}
