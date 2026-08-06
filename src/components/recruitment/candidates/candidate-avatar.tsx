import { User } from "lucide-react";
import { cn } from "@/lib/utils";

export function CandidateAvatar({
  fullName,
  imageUrl = null,
  className,
}: {
  fullName: string;
  imageUrl?: string | null;
  className?: string;
}) {
  const initials = fullName
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote profile photos; no Next Image domain config required
      <img
        src={imageUrl}
        alt=""
        className={cn(
          "h-9 w-9 shrink-0 rounded-full object-cover border border-primary/10",
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary border border-primary/10",
        className
      )}
      aria-hidden
    >
      {initials || <User className="h-4 w-4" />}
    </div>
  );
}
