import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/data-table";
import { formatLeaveDays } from "@/lib/leave-types";
import { formatDate } from "@/lib/utils";

type HistoryRow = {
  id: string;
  date: Date;
  leaveType: string;
  transactionType: string;
  amount: number;
  reason: string;
  updatedBy: string;
};

function formatType(t: string) {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function LeaveHistoryTab({ history }: { history: HistoryRow[] }) {
  return (
    <DataTable
      columns={["Date", "Type", "Transaction", "Amount", "Reason", "By"]}
      emptyMessage="No leave transactions."
    >
      {history.map((row) => (
        <DataTableRow key={row.id}>
          <DataTableCell>{formatDate(row.date)}</DataTableCell>
          <DataTableCell>
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium">{row.leaveType}</span>
          </DataTableCell>
          <DataTableCell className="text-muted-foreground">{formatType(row.transactionType)}</DataTableCell>
          <DataTableCell
            className={
              row.amount < 0 ? "font-medium text-danger tabular-nums" : "font-medium text-success tabular-nums"
            }
          >
            {row.amount > 0 ? "+" : ""}
            {formatLeaveDays(row.amount)}
          </DataTableCell>
          <DataTableCell className="max-w-xs">{row.reason}</DataTableCell>
          <DataTableCell className="text-muted-foreground">{row.updatedBy}</DataTableCell>
        </DataTableRow>
      ))}
    </DataTable>
  );
}
