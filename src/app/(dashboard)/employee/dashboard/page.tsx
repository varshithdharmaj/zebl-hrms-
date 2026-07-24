import { Suspense } from "react";
import { redirect } from "next/navigation";
import { EmployeeDashboard } from "@/components/employee/employee-dashboard";
import { AttendanceHeroSkeleton } from "@/components/employee/dashboard/attendance-hero";
import { AttendanceHeatmapSkeleton } from "@/components/employee/dashboard/attendance-heatmap";
import { Skeleton } from "@/components/ui/skeleton";
import { getSession } from "@/lib/auth";
import { parseDateRangeQuery } from "@/lib/date-range";

function EmployeeDashboardSkeleton() {
  return (
    <div className="space-y-8">
      <AttendanceHeroSkeleton />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[7.25rem] rounded-xl" />
        ))}
      </div>
      <AttendanceHeatmapSkeleton />
    </div>
  );
}

export default async function EmployeeDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    from?: string;
    to?: string;
    start?: string;
    end?: string;
    preset?: string;
    heatmapMonth?: string;
  }>;
}) {
  const session = await getSession();
  if (!session?.employeeId) redirect("/login");

  const params = await searchParams;
  const range = parseDateRangeQuery({
    from: params.from,
    to: params.to,
    start: params.start,
    end: params.end,
    preset: params.preset,
  });

  return (
    <Suspense fallback={<EmployeeDashboardSkeleton />}>
      <EmployeeDashboard
        employeeId={session.employeeId}
        employeeName={session.employeeName}
        selectedDate={params.date}
        startDate={range.from}
        endDate={range.to}
        heatmapMonth={params.heatmapMonth}
      />
    </Suspense>
  );
}
