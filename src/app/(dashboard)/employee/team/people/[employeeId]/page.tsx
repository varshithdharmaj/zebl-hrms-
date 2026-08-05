import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccessEmployeeShell, PermissionError } from "@/lib/permissions";
import { getMyTeamPerson } from "@/lib/manager/team-people-query";
import {
  MyTeamPersonSkeleton,
  MyTeamPersonView,
} from "@/components/manager/my-team-person-detail";
import { SectionCard } from "@/components/ui/section-card";

async function MyTeamPersonData({ employeeId }: { employeeId: number }) {
  const session = await getSession();
  if (!session || !canAccessEmployeeShell(session.role) || session.employeeId == null) {
    redirect("/employee/dashboard");
  }

  try {
    const data = await getMyTeamPerson(session.employeeId, employeeId);
    return <MyTeamPersonView data={data} />;
  } catch (err) {
    if (err instanceof PermissionError) {
      redirect("/employee/team/people");
    }
    console.error("[zebl] My Team person detail failed:", err);
    return (
      <SectionCard title="Something went wrong">
        <p className="text-sm text-muted-foreground">
          Couldn’t load this team member. Try again later.
        </p>
      </SectionCard>
    );
  }
}

export default async function MyTeamPersonPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId: raw } = await params;
  const employeeId = parseInt(raw, 10);
  if (!Number.isFinite(employeeId) || employeeId <= 0) {
    redirect("/employee/team/people");
  }

  return (
    <Suspense fallback={<MyTeamPersonSkeleton />}>
      <MyTeamPersonData employeeId={employeeId} />
    </Suspense>
  );
}
