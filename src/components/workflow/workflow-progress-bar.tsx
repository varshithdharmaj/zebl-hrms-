import { cn } from "@/lib/utils";

export function WorkflowProgressBar({
  percent,
  overdue,
  label,
}: {
  percent: number;
  overdue?: boolean;
  label?: string;
}) {
  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">SLA</span>
          <span className={cn("font-medium", overdue && "text-danger")}>{label}</span>
        </div>
      )}
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            overdue ? "bg-danger" : percent > 75 ? "bg-warning" : "bg-primary"
          )}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
    </div>
  );
}
