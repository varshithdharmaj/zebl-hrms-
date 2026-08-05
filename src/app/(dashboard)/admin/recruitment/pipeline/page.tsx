import Link from "next/link";
import { Suspense } from "react";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { ApplicationFilters } from "@/components/recruitment/applications/application-filters";
import { ApplicationTable } from "@/components/recruitment/applications/application-table";
import { PipelineBoard } from "@/components/recruitment/applications/pipeline-board";
import { Button } from "@/components/ui/button";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { getApplicationCached, listApplicationsCached } from "@/lib/recruitment/application";
import { getEmployeeOptions } from "@/lib/recruitment/candidate";
import { listInterviewsCached } from "@/lib/recruitment/interview/queries";
import { prisma } from "@/lib/prisma";
import { ApplicationStatus, RecruitmentPipelineStage } from "@/generated/prisma/enums";
import { MAX_PAGE_SIZE } from "@/lib/recruitment/shared/pagination";
import type { PipelineDrawerApplication } from "@/components/recruitment/applications/application-pipeline-drawer";

export default async function RecruitmentPipelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireHROrSuperAdminSession();
  const raw = await searchParams;

  const view = raw.view === "list" ? "list" : "board";
  const applicationId = typeof raw.applicationId === "string" ? raw.applicationId : undefined;

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

  const [result, employeeOptions, jobs, selectedDetail, selectedInterviews] = await Promise.all([
    listApplicationsCached(
      session,
      {
        q: filters.q,
        status: statusFilter,
        currentStage: stageFilter,
        jobOpeningId: jobFilter,
      },
      { page: 1, pageSize: MAX_PAGE_SIZE },
      { field: "createdAt", direction: "desc" }
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
  ]);

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
          id: String(selectedDetail.candidate.id),
          fullName: String(selectedDetail.candidate.fullName),
          email: selectedDetail.candidate.email ?? null,
          phone: selectedDetail.candidate.phone ?? null,
        },
        jobOpening: {
          id: String(selectedDetail.jobOpening.id),
          title: String(selectedDetail.jobOpening.title),
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
      }
    : null;

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Pipeline"
        description="Move candidates from applied to joined. Interviews, offers, and conversions live on each card."
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
            applications={result.items as PipelineDrawerApplication[]}
            employeeOptions={employeeOptions}
            selectedApplication={selectedApplication}
          />
        </Suspense>
      ) : (
        <ApplicationTable applications={result.items} employeeOptions={employeeOptions} />
      )}
    </div>
  );
}
