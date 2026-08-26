import type { ReactNode } from "react";
import { StatusBadge } from "@/components/ui/status-badge";

export { StatusBadge };

export function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
  variant?: string;
}) {
  if (typeof children === "string") {
    return <StatusBadge status={children} className={className} />;
  }
  return <span className={className}>{children}</span>;
}
