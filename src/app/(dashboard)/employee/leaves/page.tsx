import { redirect } from "next/navigation";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { LeaveRequestForm } from "@/components/employee/leave-request-form";
import { EmployeeLeaveTable } from "@/components/employee/leave-table";
import { LeaveBalanceGrid } from "@/components/leave/leave-balance-grid";
import { SectionCard } from "@/components/ui/section-card";
import { getSession } from "@/lib/auth";
import { getEmployeeLeavePageData } from "@/lib/queries";
import { getUpcomingHolidays } from "@/lib/leave/leave-calendar";
import { formatDate } from "@/lib/utils";

export default async function EmployeeLeavesPage() {
  const session = await getSession();
  if (!session?.employeeId) redirect("/login");

  const [{ balances, leaves }, holidays] = await Promise.all([
    getEmployeeLeavePageData(session.employeeId),
    getUpcomingHolidays(6),
  ]);

  return (
    <div className="space-y-6 lg:space-y-8">
      <WorkspacePageHeader
        title="Leave"
        description="View your balances and submit new leave requests."
      />

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Balances</h2>
        <LeaveBalanceGrid balances={balances} />
        <p className="text-xs text-muted-foreground">
          Plan ahead using balances above. Overlapping requests may require manager approval.
        </p>
      </section>

      {holidays.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Upcoming holidays</h2>
          <ul className="flex flex-wrap gap-2">
            {holidays.map((h) => (
              <li
                key={h.id}
                className="rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs"
              >
                {h.name} · {formatDate(h.holidayDate)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <LeaveRequestForm />

      <SectionCard title="Your requests" description={`${leaves.length} submitted`} noPadding>
        <EmployeeLeaveTable leaves={leaves} />
      </SectionCard>
    </div>
  );
}
