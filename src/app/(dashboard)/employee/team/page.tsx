import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccessEmployeeShell } from "@/lib/permissions";
import { getMyTeamOverview } from "@/lib/manager/dashboard-service";
import {
  MyTeamOverviewSkeleton,
  MyTeamOverviewView,
} from "@/components/manager/my-team-overview";

async function MyTeamOverviewData() {
  const session = await getSession();
  if (!session || !canAccessEmployeeShell(session.role) || session.employeeId == null) {
    redirect("/employee/dashboard");
  }

  const data = await getMyTeamOverview(session);
  if (!data) {
    redirect("/employee/dashboard");
  }

  return <MyTeamOverviewView data={data} />;
}

export default function MyTeamOverviewPage() {
  return (
    <Suspense fallback={<MyTeamOverviewSkeleton />}>
      <MyTeamOverviewData />
    </Suspense>
  );
}
