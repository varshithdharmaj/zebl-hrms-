import { Suspense } from "react";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { requireRecruitmentReportSession } from "@/lib/recruitment/reports/auth";
import {
  getReportBundleCached,
  listReportPresetsCached,
} from "@/lib/recruitment/reports/queries";
import { toReportFilters } from "@/lib/recruitment/reports/parse-filters";
import type { ReportSectionKey } from "@/lib/recruitment/reports/types";
import { ReportWorkspace } from "./report-workspace";
import { CommunicationLoadingSkeleton } from "@/components/recruitment/communications/communication-loading-skeleton";

async function ReportLoader({
  section,
  searchParams,
}: {
  section: ReportSectionKey;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRecruitmentReportSession();
  const raw = await searchParams;
  const filters = toReportFilters(raw);
  const [bundle, presets] = await Promise.all([
    getReportBundleCached(session, section, filters),
    listReportPresetsCached(session, section),
  ]);

  return <ReportWorkspace bundle={bundle} presets={presets} />;
}

export function ReportSectionPage({
  section,
  title,
  description,
  searchParams,
}: {
  section: ReportSectionKey;
  title: string;
  description: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title={title}
        description={description}
        backHref="/admin/recruitment/reports"
        backLabel="Back to reports"
      />
      <Suspense fallback={<CommunicationLoadingSkeleton />}>
        <ReportLoader section={section} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
