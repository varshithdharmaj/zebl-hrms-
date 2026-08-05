import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccessEmployeeShell, PermissionError } from "@/lib/permissions";
import { getMyTeamLeaveOverview } from "@/lib/manager/team-leave-query";
import { MyTeamLeaveSkeleton, MyTeamLeaveView } from "@/components/manager/my-team-leave";
import { SectionCard } from "@/components/ui/section-card";

async function MyTeamLeaveData() {
  const session = await getSession();
  if (!session || !canAccessEmployeeShell(session.role) || session.employeeId == null) {
    redirect("/employee/dashboard");
  }

  try {
    const data = await getMyTeamLeaveOverview(session.employeeId);
    return <MyTeamLeaveView data={data} />;
  } catch (err) {
    if (err instanceof PermissionError) {
      redirect("/employee/dashboard");
    }
    console.error("[zebl] My Team leave failed:", err);
    return (
      <SectionCard title="Something went wrong">
        <p className="text-sm text-muted-foreground">
          Couldn’t load team leave. Try again later.
        </p>
      </SectionCard>
    );
  }
}

export default function MyTeamLeavePage() {
  return (
    <Suspense fallback={<MyTeamLeaveSkeleton />}>
      <MyTeamLeaveData />
    </Suspense>
  );
}
