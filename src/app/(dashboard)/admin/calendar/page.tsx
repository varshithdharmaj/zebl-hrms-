import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { LeaveCalendarView } from "@/components/leave/leave-calendar-view";
import {
  getCalendarDepartments,
  getLeaveCalendarEvents,
  getUpcomingHolidays,
} from "@/lib/leave/leave-calendar";

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ department?: string }>;
}) {
  const { department } = await searchParams;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);

  const [events, holidays, departments] = await Promise.all([
    getLeaveCalendarEvents({
      start,
      end,
      department: department || undefined,
    }),
    getUpcomingHolidays(),
    getCalendarDepartments(),
  ]);

  const monthLabel = start.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-8">
      <WorkspacePageHeader
        title="Leave calendar"
        description="Organization leave and holidays — filter by department."
      />
      <LeaveCalendarView
        events={events}
        holidays={holidays}
        monthLabel={monthLabel}
        departments={departments}
        currentDepartment={department}
      />
    </div>
  );
}
