import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccessEmployeeShell, PermissionError } from "@/lib/permissions";
import { listMyTeamAttendance } from "@/lib/manager/team-attendance-query";
import type { ListMyTeamAttendanceParams } from "@/lib/manager/team-attendance-query";
import {
  MyTeamAttendanceSkeleton,
  MyTeamAttendanceView,
} from "@/components/manager/my-team-attendance";
import { SectionCard } from "@/components/ui/section-card";

function parseFilters(raw: {
  q?: string;
  from?: string;
  to?: string;
  status?: string;
  late?: string;
  early?: string;
  ot?: string;
  shortfall?: string;
  sort?: string;
  dir?: string;
  page?: string;
}): ListMyTeamAttendanceParams {
  const sort =
    raw.sort === "name" || raw.sort === "workedHours" || raw.sort === "date"
      ? raw.sort
      : "date";
  return {
    search: raw.q,
    from: raw.from,
    to: raw.to,
    status: raw.status,
    lateOnly: raw.late === "1",
    earlyExitOnly: raw.early === "1",
    overtimeOnly: raw.ot === "1",
    shortfallOnly: raw.shortfall === "1",
    sort,
    sortDir: raw.dir === "asc" ? "asc" : "desc",
    page: Math.max(1, parseInt(raw.page ?? "1", 10) || 1),
  };
}

async function MyTeamAttendanceData({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const session = await getSession();
  if (!session || !canAccessEmployeeShell(session.role) || session.employeeId == null) {
    redirect("/employee/dashboard");
  }

  const filters = parseFilters(searchParams);

  try {
    const data = await listMyTeamAttendance(session.employeeId, filters);
    return <MyTeamAttendanceView data={data} filters={filters} />;
  } catch (err) {
    if (err instanceof PermissionError) {
      redirect("/employee/dashboard");
    }
    console.error("[zebl] My Team attendance failed:", err);
    return (
      <SectionCard title="Something went wrong">
        <p className="text-sm text-muted-foreground">
          Couldn’t load team attendance. Try again later.
        </p>
      </SectionCard>
    );
  }
}

export default async function MyTeamAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    from?: string;
    to?: string;
    status?: string;
    late?: string;
    early?: string;
    ot?: string;
    shortfall?: string;
    sort?: string;
    dir?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  return (
    <Suspense fallback={<MyTeamAttendanceSkeleton />}>
      <MyTeamAttendanceData searchParams={params} />
    </Suspense>
  );
}
