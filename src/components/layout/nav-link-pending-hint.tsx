"use client";

import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Inline pending hint for App Router soft navigations.
 * Leaf `loading.tsx` Suspense is often not revealed during client transitions;
 * this gives immediate feedback on the clicked sidebar link.
 */
export function NavLinkPendingHint({ collapsed = false }: { collapsed?: boolean }) {
  const { pending } = useLinkStatus();

  return (
    <Loader2
      aria-hidden
      className={cn(
        "shrink-0 animate-spin text-current motion-reduce:animate-none",
        collapsed ? "absolute right-1.5 top-1.5 h-2.5 w-2.5" : "ml-auto h-3.5 w-3.5",
        pending ? "opacity-80" : "pointer-events-none opacity-0"
      )}
    />
  );
}
