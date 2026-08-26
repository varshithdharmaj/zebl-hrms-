import { cn } from "@/lib/utils";

export function StatsGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("hr-dashboard__stats", className)}>{children}</div>;
}
