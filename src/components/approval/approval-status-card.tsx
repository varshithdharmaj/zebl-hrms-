import { formatDate } from "@/lib/utils";
import type { PublicApprovalView } from "@/lib/approval-tokens/token-types";

export function ApprovalStatusCard({ view }: { view: PublicApprovalView }) {
  const expiresLabel = formatDate(view.expiresAt);
  const start = formatDate(new Date(view.startDate));
  const end = formatDate(new Date(view.endDate));

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-5">
      <dl className="grid gap-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Employee</dt>
          <dd className="font-medium text-foreground text-right">
            {view.employeeName}
            <span className="block text-xs font-normal text-muted-foreground">
              {view.employeeCode}
            </span>
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Leave type</dt>
          <dd className="font-medium">{view.leaveType}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Dates</dt>
          <dd className="font-medium text-right">
            {start} — {end}
            <span className="block text-xs font-normal text-muted-foreground">
              {view.days} day{view.days === 1 ? "" : "s"}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground mb-1">Reason</dt>
          <dd className="font-medium text-foreground">{view.reason}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Your role</dt>
          <dd className="font-medium capitalize">{view.approverRole.replace(/_/g, " ")}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Workflow</dt>
          <dd className="font-medium capitalize">{view.workflowStatus.replace(/_/g, " ")}</dd>
        </div>
      </dl>

      <div className="mt-4 border-t border-border pt-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Leave balances
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {view.balances.map((b) => (
            <li
              key={b.leaveType}
              className="rounded-md bg-background px-2.5 py-1 text-xs font-medium border border-border"
            >
              {b.leaveType}: {b.remaining} left
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 text-xs text-amber-700 dark:text-amber-400">
        This secure link expires on {expiresLabel}.
      </p>
    </div>
  );
}
