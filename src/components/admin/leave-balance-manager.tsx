import Link from "next/link";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { formatLeaveDays } from "@/lib/leave-types";
import type { LeaveBalanceSummary } from "@/lib/leave";

type Row = {
  employeeId: number;
  employeeCode: string;
  name: string;
  balances: LeaveBalanceSummary[];
};

export function LeaveBalanceManager({ rows }: { rows: Row[] }) {
  return (
    <DataTable columns={["Employee", "EL", "CL", "SL", ""]}>
      {rows.map((row) => {
        const el = row.balances.find((b) => b.leaveType === "EL");
        const cl = row.balances.find((b) => b.leaveType === "CL");
        const sl = row.balances.find((b) => b.leaveType === "SL");
        return (
          <DataTableRow key={row.employeeId}>
            <DataTableCell>
              <p className="font-medium">{row.name}</p>
              <p className="text-xs text-muted-foreground">{row.employeeCode}</p>
            </DataTableCell>
            <DataTableCell className="tabular-nums">{formatLeaveDays(el?.remaining ?? 0)}</DataTableCell>
            <DataTableCell className="tabular-nums">{formatLeaveDays(cl?.remaining ?? 0)}</DataTableCell>
            <DataTableCell className="tabular-nums">{formatLeaveDays(sl?.remaining ?? 0)}</DataTableCell>
            <DataTableCell>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/admin/employees/${row.employeeId}`}>Manage</Link>
              </Button>
            </DataTableCell>
          </DataTableRow>
        );
      })}
    </DataTable>
  );
}
