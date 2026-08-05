import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccessEmployeeShell, PermissionError } from "@/lib/permissions";
import {
  getMyTeamCalendar,
  type GetMyTeamCalendarParams,
  type MyTeamCalendarView,
} from "@/lib/manager/team-calendar-query";
import {
  MyTeamCalendarSkeleton,
  MyTeamCalendarView as MyTeamCalendarUi,
} from "@/components/manager/my-team-calendar";
import { SectionCard } from "@/components/ui/section-card";

function parseFilters(raw: {
  view?: string;
  date?: string;
  from?: string;
  to?: string;
}): GetMyTeamCalendarParams {
  const view: MyTeamCalendarView | undefined =
    raw.view === "week" || raw.view === "range" || raw.view === "month"
      ? raw.view
      : undefined;
  return {
    view,
    date: raw.date,
    from: raw.from,
    to: raw.to,
  };
}

async function MyTeamCalendarData({
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
    const data = await getMyTeamCalendar(session.employeeId, filters);
    return <MyTeamCalendarUi data={data} filters={filters} />;
  } catch (err) {
    if (err instanceof PermissionError) {
      redirect("/employee/dashboard");
    }
    console.error("[zebl] My Team calendar failed:", err);
    return (
      <SectionCard title="Something went wrong">
        <p className="text-sm text-muted-foreground">
          Couldn’t load team calendar. Try again later.
        </p>
      </SectionCard>
    );
  }
}

export default async function MyTeamCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    date?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const params = await searchParams;
  return (
    <Suspense fallback={<MyTeamCalendarSkeleton />}>
      <MyTeamCalendarData searchParams={params} />
    </Suspense>
  );
}
