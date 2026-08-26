import Link from "next/link";
import { Suspense } from "react";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { RecruitmentContextHeader } from "@/components/recruitment/shared/recruitment-context-header";
import { buildRecruitmentBreadcrumbs } from "@/lib/recruitment/navigation/breadcrumbs";
import { ApplicationFilters } from "@/components/recruitment/applications/application-filters";
import { ApplicationTable } from "@/components/recruitment/applications/application-table";
import { PipelineBoard } from "@/components/recruitment/applications/pipeline-board";
import type { PipelineDynamicColumn } from "@/components/recruitment/applications/pipeline-board";
import { Button } from "@/components/ui/button";
import { requireRecruitmentAdminSession } from "@/lib/auth-guards";
import { getApplicationCached, listApplicationsCached } from "@/lib/recruitment/application";
import { sanitizeApplicationsForClient } from "@/lib/recruitment/application/sanitize";
import type { ApplicationDetail } from "@/lib/recruitment/repositories/application-repository";
import { prismaJobRepository } from "@/lib/recruitment/repositories/prisma-job-repository";
import type { ApplicationTableItem } from "@/components/recruitment/applications/application-table";
import { getEmployeeOptions } from "@/lib/recruitment/candidate";
import { listInterviewsCached } from "@/lib/recruitment/interview/queries";
import {
  getCurrentHiringDecisionCached,
  getRequireDecisionForOfferCached,
} from "@/lib/recruitment/decision/queries";
import { prisma } from "@/lib/prisma";
import { TagService } from "@/lib/recruitment/tags";
import { ApplicationStatus, RecruitmentPipelineStage } from "@/generated/prisma/enums";
import { PIPELINE_STAGE_LABELS } from "@/lib/recruitment/shared/pipeline-stage-groups";
import {
  LIST_MAX_PAGE_SIZE,
  LIST_PAGE_SIZE_OPTIONS,
  DEFAULT_PAGE_SIZE,
  PIPELINE_BOARD_MAX_ITEMS,
  PIPELINE_COLUMN_PAGE_SIZE,
  normalizePipelineBoardTake,
} from "@/lib/recruitment/shared/pagination";
import type { PipelineDrawerApplication } from "@/components/recruitment/applications/application-pipeline-drawer";
import {
  parseRecruitmentNavSearch,
  resolveRecruitmentReturnTo,
  returnToLabel,
} from "@/lib/recruitment/navigation/return-to";

function normalizeListPageSize(raw: string | string[] | undefined): number {
  const n = Number(typeof raw === "string" ? raw : "");
  return LIST_PAGE_SIZE_OPTIONS.includes(n as (typeof LIST_PAGE_SIZE_OPTIONS)[number])
    ? n
    : DEFAULT_PAGE_SIZE;
}

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
  const mine = raw.mine === "1";
  const needsAttention = raw.needsAttention === "1";

  const requestedPage = Math.max(1, Number(typeof raw.page === "string" ? raw.page : "1") || 1);
  const listPageSize = normalizeListPageSize(raw.pageSize);
  const boardTake = normalizePipelineBoardTake(requestedPage);

  const filters = {
    q: typeof raw.q === "string" ? raw.q : undefined,
    status: typeof raw.status === "string" ? raw.status : "all",
    currentStage: typeof raw.currentStage === "string" ? raw.currentStage : "all",
    jobOpeningId: typeof raw.jobOpeningId === "string" ? raw.jobOpeningId : "all",
    view: view as "board" | "list",
    mine,
    needsAttention,
    pageSize: listPageSize,
  };

  const statusFilter = filters.status === "all" ? undefined : (filters.status as ApplicationStatus);
  const stageFilter =
    filters.currentStage === "all"
      ? undefined
      : (filters.currentStage as RecruitmentPipelineStage);
  const jobFilter = filters.jobOpeningId === "all" ? undefined : filters.jobOpeningId;

  const baseFilters = {
    q: filters.q,
    status: statusFilter,
    currentStage: stageFilter,
    jobOpeningId: jobFilter,
    assignedRecruiterUserId: mine ? session.id : undefined,
    needsAttention: needsAttention ? true : undefined,
  };

  // A job-scoped board renders one column per JobOpeningStage instead of the
  // fixed 5-column cross-job fallback — only possible once a single job is
  // selected and that job actually has a configured stage list.
  const jobDetail =
    view === "board" && jobFilter ? await prismaJobRepository.getJob(jobFilter) : null;
  const dynamicStages = (jobDetail?.stages ?? [])
    .filter((s) => s.isEnabled)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const boardMode: "dynamic" | "static" =
    view === "board" && jobFilter && dynamicStages.length > 0 ? "dynamic" : "static";

  const [
    listResult,
    dynamicColumnsData,
    staticBoardResult,
    employeeOptions,
    jobs,
    selectedDetail,
    selectedInterviews,
    selectedDecision,
    requireDecisionForOffer,
  ] = await Promise.all([
    view === "list"
      ? listApplicationsCached(
          session,
          baseFilters,
          { page: requestedPage, pageSize: listPageSize },
          { field: "createdAt", direction: "desc" },
          { maxPageSize: LIST_MAX_PAGE_SIZE }
        )
      : Promise.resolve(null),
    boardMode === "dynamic"
      ? Promise.all(
          dynamicStages.map(async (stage): Promise<PipelineDynamicColumn> => {
            const res = await listApplicationsCached(
              session,
              { ...baseFilters, currentStage: stage.stage },
              { page: 1, pageSize: PIPELINE_COLUMN_PAGE_SIZE },
              { field: "createdAt", direction: "desc" }
            );
            return {
              id: stage.id,
              stage: stage.stage,
              title: stage.label ?? PIPELINE_STAGE_LABELS[stage.stage] ?? String(stage.stage),
              items: sanitizeApplicationsForClient(
                res.items
              ) as unknown as PipelineDrawerApplication[],
              total: res.total,
            };
          })
        )
      : Promise.resolve(null),
    boardMode === "static"
      ? listApplicationsCached(
          session,
          baseFilters,
          { page: 1, pageSize: boardTake.take },
          { field: "createdAt", direction: "desc" },
          { maxPageSize: PIPELINE_BOARD_MAX_ITEMS }
        )
      : Promise.resolve(null),
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
  const listItems: ApplicationDetail[] = listResult
    ? sanitizeApplicationsForClient(listResult.items)
    : [];
  const staticBoardItems: ApplicationDetail[] = staticBoardResult
    ? sanitizeApplicationsForClient(staticBoardResult.items)
    : [];

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

  const selectedTags = selectedDetail?.candidate?.id
    ? await TagService.listCandidateTags(String(selectedDetail.candidate.id))
    : [];

  const selectedApplication: PipelineDrawerApplication | null = selectedDetail
    ? {
        id: String(selectedDetail.id),
        currentStage: selectedDetail.currentStage as RecruitmentPipelineStage,
        status: String(selectedDetail.status),
        priority: (selectedDetail as { priority?: string | null }).priority ?? null,
        createdAt: selectedDetail.createdAt as Date | string,
        tags: selectedTags,
        candidate: {
          id: String(selectedDetail.candidate?.id ?? ""),
          fullName: String(selectedDetail.candidate?.fullName ?? "Unknown"),
          email: selectedDetail.candidate?.email ?? null,
          phone: selectedDetail.candidate?.phone ?? null,
          totalExperienceYears:
            (selectedDetail.candidate as { totalExperienceYears?: number | string | null } | null)
              ?.totalExperienceYears ?? null,
          currentCompany:
            (selectedDetail.candidate as { currentCompany?: string | null } | null)?.currentCompany ??
            null,
          location: (selectedDetail.candidate as { location?: string | null } | null)?.location ?? null,
          noticePeriodDays:
            (selectedDetail.candidate as { noticePeriodDays?: number | null } | null)
              ?.noticePeriodDays ?? null,
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

  const filterState = {
    q: filters.q,
    status: filters.status,
    currentStage: filters.currentStage,
    jobOpeningId: filters.jobOpeningId,
    view: filters.view,
    mine: filters.mine,
    needsAttention: filters.needsAttention,
    pageSize: filters.pageSize,
  };

  return (
    <div className="w-full min-w-0 max-w-full space-y-6 lg:space-y-8">
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

      <ApplicationFilters filters={filterState} jobs={jobs} basePath="/admin/recruitment/pipeline" />

      {view === "board" ? (
        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading board…</div>}>
          {boardMode === "dynamic" ? (
            <PipelineBoard
              mode="dynamic"
              jobOpeningId={jobFilter}
              dynamicColumns={dynamicColumnsData ?? []}
              employeeOptions={employeeOptions}
              selectedApplication={selectedApplication}
            />
          ) : (
            <>
              <PipelineBoard
                mode="static"
                applications={staticBoardItems as unknown as PipelineDrawerApplication[]}
                employeeOptions={employeeOptions}
                selectedApplication={selectedApplication}
              />
              <div className="flex flex-col items-center gap-2 pt-2">
                <p className="text-xs text-muted-foreground">
                  Showing {staticBoardItems.length} of {staticBoardResult?.total ?? 0} applications
                </p>
                {boardTake.hasMoreCapacity &&
                (staticBoardResult?.total ?? 0) > (staticBoardResult?.items.length ?? 0) ? (
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
                        ...(mine ? { mine: "1" } : {}),
                        ...(needsAttention ? { needsAttention: "1" } : {}),
                        view: "board",
                        page: String(boardTake.page + 1),
                        ...(applicationId ? { applicationId } : {}),
                      }).toString()}`}
                    >
                      Load more
                    </Link>
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </Suspense>
      ) : (
        <ApplicationTable
          applications={listItems as unknown as ApplicationTableItem[]}
          employeeOptions={employeeOptions}
          pagination={{
            page: listResult?.page ?? 1,
            pageSize: listResult?.pageSize ?? listPageSize,
            total: listResult?.total ?? 0,
            totalPages: listResult?.totalPages ?? 0,
          }}
          filters={filterState}
        />
      )}
    </div>
  );
}
