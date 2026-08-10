"use client";

import { useLinkStatus } from "next/link";
import { cn } from "@/lib/utils";

/**
 * Inline pending hint for App Router soft navigations.
 * Leaf `loading.tsx` Suspense is often not revealed during client transitions;
 * this gives immediate feedback on the clicked sidebar link.
 */
export function NavLinkPendingHint() {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden
      className={cn(
        "ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-current",
        pending ? "animate-pulse opacity-70 motion-reduce:animate-none" : "opacity-0"
      )}
    />
  );
}
