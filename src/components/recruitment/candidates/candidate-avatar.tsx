import { User } from "lucide-react";
import { cn } from "@/lib/utils";

export function CandidateAvatar({
  fullName,
  className,
}: {
  fullName: string;
  className?: string;
}) {
  const initials = fullName
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <div
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary border border-primary/10",
        className
      )}
    >
      {initials || <User className="h-4 w-4" />}
    </div>
  );
}
