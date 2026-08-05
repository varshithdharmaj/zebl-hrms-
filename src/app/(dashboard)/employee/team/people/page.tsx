import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccessEmployeeShell, PermissionError } from "@/lib/permissions";
import { listMyTeamPeople } from "@/lib/manager/team-people-query";
import {
  MyTeamPeopleSkeleton,
  MyTeamPeopleView,
} from "@/components/manager/my-team-people";
import { SectionCard } from "@/components/ui/section-card";

async function MyTeamPeopleData({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const session = await getSession();
  if (!session || !canAccessEmployeeShell(session.role) || session.employeeId == null) {
    redirect("/employee/dashboard");
  }

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const search = searchParams.q ?? "";

  try {
    const data = await listMyTeamPeople(session.employeeId, { search, page });
    return <MyTeamPeopleView data={data} search={search} />;
  } catch (err) {
    if (err instanceof PermissionError) {
      redirect("/employee/dashboard");
    }
    console.error("[zebl] My Team people list failed:", err);
    return (
      <SectionCard title="Something went wrong">
        <p className="text-sm text-muted-foreground">
          Couldn’t load your team. Try again later.
        </p>
      </SectionCard>
    );
  }
}

export default async function MyTeamPeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  return (
    <Suspense fallback={<MyTeamPeopleSkeleton />}>
      <MyTeamPeopleData searchParams={params} />
    </Suspense>
  );
}
