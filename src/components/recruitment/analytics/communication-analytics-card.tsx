import { Mail, MessageSquareReply, FileEdit, LayoutTemplate } from "lucide-react";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { StatsGrid } from "@/components/ui/stats-grid";
import type { CommunicationAnalytics } from "@/lib/recruitment/services/communication-phase5";

export function CommunicationAnalyticsCard({
  analytics,
}: {
  analytics: CommunicationAnalytics;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-subtle">
      <div>
        <h2 className="text-base font-semibold text-foreground">Communication Analytics</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Email volume, drafts, template usage, and recruiter activity.
        </p>
      </div>

      <StatsGrid>
        <DashboardCard
          label="Emails Sent"
          value={analytics.emailsSent}
          icon={Mail}
          accent="blue"
        />
        <DashboardCard
          label="Open Rate"
          value={
            analytics.openRatePlaceholder == null
              ? "—"
              : `${analytics.openRatePlaceholder}%`
          }
          icon={Mail}
          accent="teal"
        />
        <DashboardCard
          label="Replies"
          value={analytics.replies}
          icon={MessageSquareReply}
          accent="green"
        />
        <DashboardCard
          label="Drafts"
          value={analytics.draftCount}
          icon={FileEdit}
          accent="amber"
        />
      </StatsGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Templates usage
          </h3>
          {analytics.templateUsage.length === 0 ? (
            <p className="text-xs text-muted-foreground">No template usage yet.</p>
          ) : (
            <ul className="space-y-2">
              {analytics.templateUsage.map((item) => (
                <li
                  key={item.templateId}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <LayoutTemplate className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    {item.templateName}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{item.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Messages by recruiter
          </h3>
          {analytics.messagesByRecruiter.length === 0 ? (
            <p className="text-xs text-muted-foreground">No recruiter activity yet.</p>
          ) : (
            <ul className="space-y-2">
              {analytics.messagesByRecruiter.map((item) => (
                <li
                  key={item.senderUserId}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="font-medium truncate">
                    {item.senderEmail ?? item.senderUserId}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{item.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Scheduled: {analytics.scheduledCount} · Expired (pending send):{" "}
        {analytics.expiredScheduledCount} · Failed: {analytics.failedCount}. Open rate
        requires provider webhooks (placeholder).
      </p>
    </section>
  );
}
