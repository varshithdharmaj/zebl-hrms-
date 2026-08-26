import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  present: "bg-success-muted text-success ring-1 ring-success/15",
  absent: "bg-danger-muted text-danger ring-1 ring-danger/15",
  short: "bg-warning-muted text-warning ring-1 ring-warning/15",
  pending: "bg-warning-muted text-warning ring-1 ring-warning/15",
  approved: "bg-success-muted text-success ring-1 ring-success/15",
  rejected: "bg-danger-muted text-danger ring-1 ring-danger/15",
  default: "bg-muted text-muted-foreground ring-1 ring-border",
  active: "bg-success-muted text-success ring-1 ring-success/15",
  inactive: "bg-muted text-muted-foreground ring-1 ring-border",
  resigned: "bg-danger-muted text-danger ring-1 ring-danger/15",
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
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        styles[variant],
        className
      )}
    >
      {status}
    </span>
  );
}
