import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ManagerApprovalInbox } from "@/components/manager/manager-approval-inbox";
import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { getSession } from "@/lib/auth";
import { listLeaveApprovalInboxItems } from "@/lib/approvals/approval-center-service";
import type { PendingApprovalItem } from "@/lib/approvals/leave-inbox-types";
import { SectionCard } from "@/components/ui/section-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

async function ApprovalCenterContent() {
  const session = await getSession();
  if (!session?.employeeId) redirect("/employee/dashboard");

  let items: PendingApprovalItem[] = [];
  let loadError: string | null = null;
  try {
    items = await listLeaveApprovalInboxItems(session);
  } catch (err) {
    console.error("[zebl] Approval Center load failed:", err);
    items = [];
    loadError = "Couldn’t load your approval queue. Try again later.";
  }

  return (
    <div className="space-y-8">
      <WorkspacePageHeader
        title="Approval Center"
        description="Review and act on items that need your decision."
        badge={
          !loadError && items.length > 0 ? (
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-warning px-2 text-xs font-bold text-warning-foreground">
              {items.length}
            </span>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Approval type">
        <span
          role="tab"
          aria-selected="true"
          className={cn(
            "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
            "border-foreground bg-foreground text-background"
          )}
        >
          Leave
        </span>
      </div>

      {loadError ? (
        <SectionCard title="Something went wrong">
          <p className="text-sm text-muted-foreground">{loadError}</p>
        </SectionCard>
      ) : (
        <ManagerApprovalInbox items={items} />
      )}
    </div>
  );
}

function ApprovalCenterSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-10 w-24 rounded-full" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export default function EmployeeApprovalsPage() {
  return (
    <Suspense fallback={<ApprovalCenterSkeleton />}>
      <ApprovalCenterContent />
    </Suspense>
  );
}
