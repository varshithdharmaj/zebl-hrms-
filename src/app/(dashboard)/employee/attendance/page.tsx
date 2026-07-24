import { Suspense } from "react";
import { redirect } from "next/navigation";
import { EmployeeAttendanceView } from "@/components/employee/employee-attendance-view";
import { PageSkeleton } from "@/components/ui/skeleton";
import { getSession } from "@/lib/auth";
import { parseDateRangeQuery } from "@/lib/date-range";

export default async function EmployeeAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    start?: string;
    end?: string;
    from?: string;
    to?: string;
    preset?: string;
  }>;
}) {
  const session = await getSession();
  if (!session?.employeeId) redirect("/login");

  const raw = await searchParams;
  const page = Math.max(1, parseInt(raw.page ?? "1", 10) || 1);
  const hasRange = Boolean(raw.from || raw.to || raw.start || raw.end || raw.preset);
  const range = parseDateRangeQuery({
    from: raw.from,
    to: raw.to,
    start: raw.start,
    end: raw.end,
    preset: raw.preset,
  });

  return (
    <Suspense fallback={<PageSkeleton />}>
      <EmployeeAttendanceView
        employeeId={session.employeeId}
        startDate={hasRange ? range.from : undefined}
        endDate={hasRange ? range.to : undefined}
        page={page}
      />
    </Suspense>
  );
}
