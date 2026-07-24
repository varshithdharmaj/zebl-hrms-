import { StatusBadge } from "@/components/ui/status-badge";
import { CATEGORY_LABELS, PRIORITY_COLORS } from "@/lib/tickets/labels";

export function TicketCategoryBadge({ category }: { category: string }) {
  return (
    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800">
      {CATEGORY_LABELS[category] || category}
    </span>
  );
}

export function TicketPriorityBadge({ priority }: { priority: string }) {
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${
        PRIORITY_COLORS[priority] || "bg-slate-100 text-slate-700"
      }`}
    >
      {priority}
    </span>
  );
}

export function TicketStatusCell({ status }: { status: string }) {
  return <StatusBadge status={status.replace(/_/g, " ")} />;
}
