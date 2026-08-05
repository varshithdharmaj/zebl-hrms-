import Link from "next/link";
import { Mail, FileEdit, Clock3, Inbox } from "lucide-react";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { StatsGrid } from "@/components/ui/stats-grid";
import { Button } from "@/components/ui/button";

export type CommunicationWidgetStats = {
  unread: number;
  drafts: number;
  scheduled: number;
  sent?: number;
};

export function CommunicationSummaryWidget({
  stats,
  recent,
  title = "Communication",
  composeHref = "/admin/recruitment/communications/new",
  centerHref = "/admin/recruitment/communications",
}: {
  stats: CommunicationWidgetStats;
  recent?: Array<{ id: string; subject: string | null; createdAt: string }>;
  title?: string;
  composeHref?: string;
  centerHref?: string;
}) {
  return (
    <section className="space-y-4" aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={centerHref}>Open inbox</Link>
          </Button>
          <Button asChild size="sm">
            <Link href={composeHref}>Compose</Link>
          </Button>
        </div>
      </div>

      <StatsGrid>
        <DashboardCard label="Unread Messages" value={stats.unread} icon={Inbox} accent="amber" />
        <DashboardCard label="Drafts" value={stats.drafts} icon={FileEdit} accent="blue" />
        <DashboardCard label="Scheduled Emails" value={stats.scheduled} icon={Clock3} accent="teal" />
        {typeof stats.sent === "number" && (
          <DashboardCard label="Sent" value={stats.sent} icon={Mail} accent="green" />
        )}
      </StatsGrid>

      {recent && recent.length > 0 && (
        <ul className="space-y-2 rounded-xl border border-border/70 bg-card p-4" aria-label="Recent activity">
          {recent.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 text-xs">
              <span className="truncate font-medium text-foreground">
                {item.subject?.trim() || "Untitled"}
              </span>
              <time className="shrink-0 text-muted-foreground">
                {new Date(item.createdAt).toLocaleDateString()}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
