import { requireRecruitmentReportSession } from "@/lib/recruitment/reports/auth";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { ReportHub } from "@/components/recruitment/reports/report-hub";
import { SectionCard } from "@/components/ui/section-card";
import {
  getHiringFunnelCached,
  getOfferAnalyticsCached,
  getRecruiterPerformanceCached,
  getSourceAnalyticsCached,
  getTimeMetricsCached,
} from "@/lib/recruitment/analytics";
import { HiringFunnelCard } from "@/components/recruitment/analytics/hiring-funnel-card";
import { TimeMetricsCard } from "@/components/recruitment/analytics/time-metrics-card";
import { SourceAnalyticsCard } from "@/components/recruitment/analytics/source-analytics-card";
import { RecruiterPerformanceTable } from "@/components/recruitment/analytics/recruiter-performance-table";
import { OfferAnalyticsCard } from "@/components/recruitment/analytics/offer-analytics-card";

export default async function RecruitmentReportsPage() {
  const session = await requireRecruitmentReportSession();

  const [funnel, timeMetrics, sources, recruiters, offers] = await Promise.all([
    getHiringFunnelCached(session),
    getTimeMetricsCached(session),
    getSourceAnalyticsCached(session),
    getRecruiterPerformanceCached(session),
    getOfferAnalyticsCached(session),
  ]);

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Reports"
        description="Startup hiring insights and exportable reports."
        backHref="/admin/recruitment"
        backLabel="Back to dashboard"
      />

      <SectionCard
        title="Insights"
        description="Time to hire, sources, recruiter workload, funnel, and offer acceptance."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <TimeMetricsCard metrics={timeMetrics} />
          <HiringFunnelCard funnel={funnel} />
          <SourceAnalyticsCard analytics={sources} />
          <OfferAnalyticsCard analytics={offers} />
        </div>
        <div className="mt-4">
          <RecruiterPerformanceTable performance={recruiters} />
        </div>
      </SectionCard>

      <ReportHub />
    </div>
  );
}
