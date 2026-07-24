"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type PopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "end";
  className?: string;
  contentClassName?: string;
};

/**
 * Lightweight accessible popover (Radix-free) matching existing Sheet/toolbar patterns.
 */
export function Popover({
  open,
  onOpenChange,
  trigger,
  children,
  align = "start",
  className,
  contentClassName,
}: PopoverProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }

    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (rootRef.current && !rootRef.current.contains(target)) onOpenChange(false);
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, onOpenChange]);

  return (
    <div className={cn("relative inline-flex max-w-full", className)} ref={rootRef}>
      {trigger}
      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          className={cn(
            "absolute z-40 mt-2 w-[min(100vw-1.5rem,22rem)] rounded-xl border border-border bg-popover p-3 text-sm shadow-elevated",
            align === "end" ? "right-0" : "left-0",
            contentClassName
          )}
        >
          <span id={titleId} className="sr-only">
            Date range picker
          </span>
          {children}
        </div>
      )}
    </div>
  );
}

export function usePopoverState(initial = false) {
  const [open, setOpen] = useState(initial);
  return { open, setOpen, onOpenChange: setOpen };
}
