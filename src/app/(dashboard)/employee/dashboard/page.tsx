import { Suspense } from "react";
import { redirect } from "next/navigation";
import { EmployeeDashboard } from "@/components/employee/employee-dashboard";
import { PageSkeleton } from "@/components/ui/skeleton";
import { getSession } from "@/lib/auth";

export default async function EmployeeDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    start?: string;
    end?: string;
    heatmapMonth?: string;
  }>;
}) {
  const session = await getSession();
  if (!session?.employeeId) redirect("/login");

  const { date, start, end, heatmapMonth } = await searchParams;

  return (
    <Suspense fallback={<PageSkeleton />}>
      <EmployeeDashboard
        employeeId={session.employeeId}
        employeeName={session.employeeName}
        selectedDate={date}
        startDate={start}
        endDate={end}
        heatmapMonth={heatmapMonth}
      />
    </Suspense>
  );
}
