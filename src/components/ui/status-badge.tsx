import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  present: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20",
  absent: "bg-rose-50 text-rose-700 ring-1 ring-rose-600/20",
  short: "bg-amber-50 text-amber-800 ring-1 ring-amber-600/20",
  pending: "bg-amber-50 text-amber-800 ring-1 ring-amber-600/20",
  approved: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20",
  rejected: "bg-rose-50 text-rose-700 ring-1 ring-rose-600/20",
  default: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  active: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20",
  inactive: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  resigned: "bg-rose-50 text-rose-700 ring-1 ring-rose-600/20",
};

function resolveVariant(status: string): string {
  const s = status.toLowerCase();
  if (s === "present" || s === "active") return "present";
  if (s === "absent" || s === "resigned") return "absent";
  if (s.includes("short")) return "short";
  if (s === "pending") return "pending";
  if (s === "approved") return "approved";
  if (s === "rejected") return "rejected";
  if (s === "inactive") return "inactive";
  return "default";
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const variant = resolveVariant(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium tracking-tight",
        styles[variant],
        className
      )}
    >
      {status}
    </span>
  );
}
