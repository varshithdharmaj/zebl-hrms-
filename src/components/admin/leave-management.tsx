"use client";

import { useState } from "react";
import { AppTabs, type TabDef } from "@/components/ui/app-tabs";
import { AdminLeaveTable } from "@/components/admin/leave-table";
import { LeaveBalanceManager } from "@/components/admin/leave-balance-manager";
import type { LeaveBalanceSummary } from "@/lib/leave";
import { LeaveWorkflowStatus } from "@prisma/client";
import { TableToolbar } from "@/components/ui/table-toolbar";

type Leave = {
  id: number;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  days: number;
  reason: string;
  status: string;
  workflowStatus: LeaveWorkflowStatus;
  version: number;
  rejectionReason: string | null;
  submittedAt: Date | null;
  currentStepId: number | null;
  createdAt: Date;
  employee: { name: string; employeeCode: string };
  approvalSteps: {
    id: number;
    stepOrder: number;
    approverRole: string;
    status: string;
    actedAt: Date | null;
    comment: string | null;
    approver: { name: string } | null;
  }[];
};

type BalanceRow = {
  employeeId: number;
  employeeCode: string;
  name: string;
  department: string | null;
  joiningDate: Date;
  balances: LeaveBalanceSummary[];
};

export function LeaveManagement({
  leaves,
  balanceRows,
  initialStatus = "",
  initialSearch = "",
}: {
  leaves: Leave[];
  balanceRows: BalanceRow[];
  initialStatus?: string;
  initialSearch?: string;
}) {
  const pending = leaves.filter(
    (l) =>
      l.workflowStatus === LeaveWorkflowStatus.pending_approval ||
      l.workflowStatus === LeaveWorkflowStatus.submitted
  ).length;
  const tabs: TabDef[] = [
    { id: "requests", label: "Requests", count: pending },
    { id: "balances", label: "Balances" },
  ];
  const [active, setActive] = useState("requests");

  return (
    <div className="space-y-6">
      <TableToolbar
        initialSearch={initialSearch}
        initialStatus={initialStatus}
        clearHref="/admin/leaves"
        statusOptions={[
          { value: "pending_approval", label: "Pending approval" },
          { value: "approved", label: "Approved" },
          { value: "rejected", label: "Rejected" },
        ]}
      />
      <AppTabs tabs={tabs} active={active} onChange={setActive} />
      {active === "requests" && <AdminLeaveTable leaves={leaves} />}
      {active === "balances" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Open an employee profile to adjust balances. All changes are logged.
          </p>
          <LeaveBalanceManager rows={balanceRows} />
        </div>
      )}
    </div>
  );
}
