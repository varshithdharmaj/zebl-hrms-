import { Users, ClipboardCheck, UserCircle } from "lucide-react";
import { StatsGrid } from "@/components/ui/stats-grid";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { SectionCard } from "@/components/ui/section-card";

export function ManagerDashboardView({
  directReportsCount,
  pendingApprovalsCount,
}: {
  directReportsCount: number;
  pendingApprovalsCount: number;
}) {
  return (
    <div className="space-y-8">
      <StatsGrid>
        <DashboardCard
          label="Direct reports"
          value={directReportsCount}
          icon={Users}
          accent="blue"
        />
        <DashboardCard
          label="Pending approvals"
          value={pendingApprovalsCount}
          icon={ClipboardCheck}
          accent="amber"
          hint="Awaiting your approval"
        />
      </StatsGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Approval inbox"
          description="Review and act on team leave requests."
        >
          <a
            href="/manager/approvals"
            className="text-sm font-medium text-primary hover:underline"
          >
            Open approval inbox →
          </a>
        </SectionCard>

        <SectionCard
          title="Team overview"
          description="Reporting structure and team leave calendar will be added in a later phase."
        >
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <UserCircle className="h-5 w-5 shrink-0" />
            <span>
              Assign managers from Admin → Employees → Profile to build your org hierarchy.
            </span>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
