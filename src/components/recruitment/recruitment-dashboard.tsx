import Link from "next/link";
import {
  Briefcase,
  Calendar,
  Clock,
  FileCheck,
  UserCheck,
  Users,
  ClipboardList,
  Plus,
  ArrowRight,
} from "lucide-react";
import type { JobStatusCounts } from "@/lib/recruitment/job/types";
import type { HiringFunnelCounts } from "@/lib/recruitment/dashboard/build-funnel-counts";
import { StatsGrid } from "@/components/ui/stats-grid";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { Button } from "@/components/ui/button";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { SectionCard } from "@/components/ui/section-card";
import { EmptyState } from "@/components/ui/empty-state";
import { DashboardFunnelWidget } from "@/components/recruitment/dashboard/dashboard-funnel-widget";
import { DashboardPendingConversionsWidget } from "@/components/recruitment/dashboard/dashboard-pending-conversions-widget";
import { DashboardOfferSummaryWidget } from "@/components/recruitment/dashboard/dashboard-offer-summary-widget";

type RecentCandidate = {
  id: string;
  fullName: string;
  currentTitle: string | null;
  currentCompany: string | null;
  createdAt: Date | string;
};

type UpcomingInterview = {
  id: string;
  title: string;
  scheduledStart: Date | string;
  candidateName?: string | null;
  jobTitle?: string | null;
};

type ActivityItem = {
  id: string;
  summary: string;
  createdAt: Date | string;
};

type PendingConversionItem = {
  id: string;
  offerNumber?: string | null;
  acceptedAt?: Date | string | null;
  candidate: { id: string; fullName: string };
  jobTitle: string;
};

export function RecruitmentDashboardView({
  counts,
  interviewMetrics,
  applicationTotal,
  funnel,
  offerMetrics = {
    draft: 0,
    sent: 0,
    accepted: 0,
    declined: 0,
    withdrawn: 0,
    expired: 0,
    acceptanceRate: 0,
  },
  conversionMetrics = {
    offersAccepted: 0,
    employeesJoined: 0,
    pendingConversions: 0,
    conversionRate: 0,
  },
  pendingConversions = [],
  recentCandidates = [],
  upcomingInterviews = [],
  activityFeed = [],
}: {
  counts: JobStatusCounts;
  interviewMetrics: {
    todayInterviews: number;
    upcomingInterviews: number;
  };
  applicationTotal: number;
  funnel: HiringFunnelCounts;
  offerMetrics?: {
    draft: number;
    sent: number;
    accepted: number;
    declined: number;
    withdrawn: number;
    expired: number;
    acceptanceRate: number;
  };
  conversionMetrics?: {
    offersAccepted: number;
    employeesJoined: number;
    pendingConversions: number;
    conversionRate: number;
  };
  pendingConversions?: PendingConversionItem[];
  recentCandidates?: RecentCandidate[];
  upcomingInterviews?: UpcomingInterview[];
  activityFeed?: ActivityItem[];
}) {
  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Recruitment Dashboard"
        description="Today’s hiring command center — interviews, pipeline, and next actions."
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="font-semibold shadow-subtle">
              <Link href="/admin/recruitment/pipeline">Open Pipeline</Link>
            </Button>
            <Button asChild className="font-semibold shadow-subtle">
              <Link href="/admin/recruitment/jobs/new">Create Job</Link>
            </Button>
          </div>
        }
      />

      <StatsGrid>
        <DashboardCard
          label="Today's Interviews"
          value={interviewMetrics.todayInterviews}
          icon={Clock}
          accent="amber"
        />
        <DashboardCard label="Open Jobs" value={counts.open} icon={Briefcase} accent="green" />
        <DashboardCard
          label="Applications"
          value={applicationTotal}
          icon={ClipboardList}
          accent="blue"
        />
        <Link href="/admin/recruitment/offers?status=released" className="block h-full">
          <DashboardCard
            label="Offers Awaiting Response"
            value={offerMetrics.sent}
            icon={FileCheck}
            accent="teal"
          />
        </Link>
        <Link href="/admin/recruitment/conversions" className="block h-full">
          <DashboardCard
            label="Pending Conversions"
            value={conversionMetrics.pendingConversions}
            icon={UserCheck}
            accent="amber"
            hint="Open queue"
          />
        </Link>
      </StatsGrid>

      <DashboardFunnelWidget funnel={funnel} />

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardOfferSummaryWidget
          summary={{
            draft: offerMetrics.draft,
            sent: offerMetrics.sent,
            accepted: offerMetrics.accepted,
            declined: offerMetrics.declined,
            withdrawn: offerMetrics.withdrawn,
            expired: offerMetrics.expired,
          }}
        />
        <DashboardPendingConversionsWidget items={pendingConversions} />
      </div>

      <SectionCard title="Quick Actions" description="Common hiring tasks in one place.">
        <div className="flex flex-wrap gap-2">
          <Button asChild className="font-semibold shadow-subtle">
            <Link href="/admin/recruitment/jobs/new">
              <Plus className="mr-1.5 h-4 w-4" />
              Create Job
            </Link>
          </Button>
          <Button asChild variant="outline" className="font-semibold shadow-subtle">
            <Link href="/admin/recruitment/candidates/new">
              <Plus className="mr-1.5 h-4 w-4" />
              Add Candidate
            </Link>
          </Button>
          <Button asChild variant="outline" className="font-semibold shadow-subtle">
            <Link href="/admin/recruitment/pipeline">
              <ClipboardList className="mr-1.5 h-4 w-4" />
              Open Pipeline
            </Link>
          </Button>
          <Button asChild variant="outline" className="font-semibold shadow-subtle">
            <Link href="/admin/recruitment/conversions">
              <UserCheck className="mr-1.5 h-4 w-4" />
              Pending Conversions
            </Link>
          </Button>
          <Button asChild variant="outline" className="font-semibold shadow-subtle">
            <Link href="/admin/recruitment/offers/new">
              <FileCheck className="mr-1.5 h-4 w-4" />
              Create Offer
            </Link>
          </Button>
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Upcoming Interviews"
          description={`${interviewMetrics.upcomingInterviews} scheduled ahead.`}
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/recruitment/interviews">
                Interviews
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          }
        >
          {upcomingInterviews.length === 0 ? (
            <EmptyState
              title="No upcoming interviews"
              description="Schedule from an application in Pipeline."
            />
          ) : (
            <ul className="divide-y divide-border">
              {upcomingInterviews.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[item.candidateName, item.jobTitle].filter(Boolean).join(" · ") ||
                        "Interview"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(item.scheduledStart).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                      <Link href={`/admin/recruitment/interviews/${item.id}`}>Open</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Recent Candidates"
          description="Latest profiles added."
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/recruitment/candidates">
                All
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          }
        >
          {recentCandidates.length === 0 ? (
            <EmptyState title="No candidates yet" description="Add a candidate to get started." />
          ) : (
            <ul className="divide-y divide-border">
              {recentCandidates.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.fullName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[c.currentTitle, c.currentCompany].filter(Boolean).join(" · ") ||
                        "Candidate"}
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm" className="h-7 text-xs shrink-0">
                    <Link href={`/admin/recruitment/candidates/${c.id}`}>
                      <Users className="mr-1 h-3 w-3" />
                      Open
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Recent Activity" description="Latest recruitment events.">
        {activityFeed.length === 0 ? (
          <EmptyState
            title="No activity yet"
            description="Pipeline moves and hires will show here."
          />
        ) : (
          <ul className="divide-y divide-border">
            {activityFeed.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 py-2.5 text-sm"
              >
                <p className="text-muted-foreground">{item.summary}</p>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
