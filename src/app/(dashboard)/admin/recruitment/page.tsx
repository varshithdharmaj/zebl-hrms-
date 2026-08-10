import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { getJobDashboardCountsCached } from "@/lib/recruitment/job/queries";
import { getInterviewDashboardMetricsCached, listInterviewsCached } from "@/lib/recruitment/interview/queries";
import { getOfferDashboardMetricsCached } from "@/lib/recruitment/offer/queries";
import {
  getConversionDashboardMetricsCached,
  listPendingConversionsCached,
} from "@/lib/recruitment/conversion/queries";
import { getDashboardMetricsCached } from "@/lib/recruitment/application/queries";
import { listCandidatesCached } from "@/lib/recruitment/candidate/queries";
import { RecruitmentTimelineService } from "@/lib/recruitment/services/timeline-service";
import { RecruitmentDashboardView } from "@/components/recruitment/recruitment-dashboard";
import { buildHiringFunnelCounts } from "@/lib/recruitment/dashboard/build-funnel-counts";
import { withTiming } from "@/lib/observability/timing";

export default async function RecruitmentDashboardPage() {
  const session = await requireHROrSuperAdminSession();
  const [
    counts,
    interviewMetrics,
    offerMetrics,
    conversionMetrics,
    applicationMetrics,
    pendingOffers,
    candidatesResult,
    interviewsResult,
    timeline,
  ] = await withTiming("recruitment.dashboard.load", () =>
    Promise.all([
      getJobDashboardCountsCached(session),
      getInterviewDashboardMetricsCached(session),
      getOfferDashboardMetricsCached(session),
      getConversionDashboardMetricsCached(session),
      getDashboardMetricsCached(session),
      listPendingConversionsCached(session),
      listCandidatesCached(session, {}, { page: 1, pageSize: 8 }, {
        field: "createdAt",
        direction: "desc",
      }),
      listInterviewsCached(session, {}, { page: 1, pageSize: 8 }, {
        field: "scheduledStart",
        direction: "asc",
      }),
      RecruitmentTimelineService.buildTimeline({ limit: 12 }),
    ])
  );

  const now = Date.now();
  const upcomingInterviews = interviewsResult.items
    .filter((item) => {
      const start = item.scheduledStart ? new Date(item.scheduledStart as string | Date).getTime() : 0;
      return start >= now;
    })
    .slice(0, 6)
    .map((item) => ({
      id: String(item.id),
      title: String(item.title ?? "Interview"),
      scheduledStart: item.scheduledStart as Date | string,
      candidateName:
        (item as { application?: { candidate?: { fullName?: string } } }).application?.candidate
          ?.fullName ?? null,
      jobTitle:
        (item as { application?: { jobOpening?: { title?: string } } }).application?.jobOpening
          ?.title ?? null,
    }));

  const countsRecord =
    (applicationMetrics.counts as Record<string, number> | undefined) ??
    (applicationMetrics as Record<string, number>);

  const applicationTotal =
    typeof countsRecord.total === "number"
      ? countsRecord.total
      : Number(countsRecord.total ?? 0);

  const offerSent = Number((offerMetrics as Record<string, unknown>).sent ?? 0);
  const offerAccepted = Number((offerMetrics as Record<string, unknown>).accepted ?? 0);
  const pendingConversionCount = Number(
    (conversionMetrics as Record<string, unknown>).pendingConversions ?? 0
  );

  const funnel = buildHiringFunnelCounts({
    stageCounts: countsRecord,
    offerSent,
    offerAccepted,
    pendingConversion: pendingConversionCount,
  });

  const pendingConversions = (pendingOffers as Array<Record<string, unknown>>)
    .slice(0, 5)
    .map((offer) => {
      const application = offer.application as {
        candidate?: { id?: string; fullName?: string };
        jobOpening?: { title?: string };
      };
      return {
        id: String(offer.id),
        offerNumber: (offer.offerNumber as string | null) ?? null,
        acceptedAt: (offer.acceptedAt as Date | string | null) ?? null,
        candidate: {
          id: String(application?.candidate?.id ?? ""),
          fullName: String(application?.candidate?.fullName ?? "Candidate"),
        },
        jobTitle: String(application?.jobOpening?.title ?? "Job"),
      };
    });

  return (
    <RecruitmentDashboardView
      counts={counts}
      interviewMetrics={{
        todayInterviews: Number(interviewMetrics.todayInterviews ?? 0),
        upcomingInterviews: Number(interviewMetrics.upcomingInterviews ?? 0),
      }}
      applicationTotal={applicationTotal}
      funnel={funnel}
      offerMetrics={{
        draft: Number((offerMetrics as Record<string, unknown>).draft ?? 0),
        sent: offerSent,
        accepted: offerAccepted,
        declined: Number((offerMetrics as Record<string, unknown>).declined ?? 0),
        withdrawn: Number((offerMetrics as Record<string, unknown>).withdrawn ?? 0),
        expired: Number((offerMetrics as Record<string, unknown>).expired ?? 0),
        acceptanceRate: Number((offerMetrics as Record<string, unknown>).acceptanceRate ?? 0),
      }}
      conversionMetrics={{
        offersAccepted: Number(
          (conversionMetrics as Record<string, unknown>).offersAccepted ?? 0
        ),
        employeesJoined: Number(
          (conversionMetrics as Record<string, unknown>).employeesJoined ?? 0
        ),
        pendingConversions: pendingConversionCount,
        conversionRate: Number(
          (conversionMetrics as Record<string, unknown>).conversionRate ?? 0
        ),
      }}
      pendingConversions={pendingConversions}
      recentCandidates={candidatesResult.items.map((c) => ({
        id: String(c.id),
        fullName: String(c.fullName ?? "Candidate"),
        currentTitle: (c.currentTitle as string | null) ?? null,
        currentCompany: (c.currentCompany as string | null) ?? null,
        createdAt: c.createdAt as Date | string,
      }))}
      upcomingInterviews={upcomingInterviews}
      activityFeed={timeline.map((item) => ({
        id: item.id,
        summary: item.summary,
        createdAt: item.createdAt,
      }))}
    />
  );
}
