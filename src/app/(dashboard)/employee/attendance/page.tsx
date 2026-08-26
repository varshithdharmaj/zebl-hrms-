import { Suspense } from "react";
import { redirect } from "next/navigation";
import { EmployeeAttendanceView } from "@/components/employee/employee-attendance-view";
import { PageSkeleton } from "@/components/ui/skeleton";
import { getSession } from "@/lib/auth";

export default async function EmployeeAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; start?: string; end?: string }>;
}) {
  const session = await getSession();
  if (!session?.employeeId) redirect("/login");

  const { page: pageStr, start, end } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);

  return (
    <Suspense fallback={<PageSkeleton />}>
      <EmployeeAttendanceView
        employeeId={session.employeeId}
        startDate={start}
        endDate={end}
        page={page}
      />
    </Suspense>
  );
}
