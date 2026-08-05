"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface AlertDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  cancelLabel?: string;
  actionLabel?: string;
  onAction: () => void;
  isActionDestructive?: boolean;
  isPending?: boolean;
}

export function AlertDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  cancelLabel = "Cancel",
  actionLabel = "Confirm",
  onAction,
  isActionDestructive = false,
  isPending = false,
}: AlertDialogProps) {
  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm transition-opacity" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-elevated focus:outline-none animate-in fade-in-50 zoom-in-95 duration-200">
          <div className="space-y-4">
            <div className="space-y-2">
              <DialogPrimitive.Title className="text-lg font-semibold text-foreground">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="text-sm text-muted-foreground leading-relaxed">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 sm:gap-0">
              <DialogPrimitive.Close asChild>
                <Button variant="outline" size="sm" disabled={isPending}>
                  {cancelLabel}
                </Button>
              </DialogPrimitive.Close>
              <Button
                variant={isActionDestructive ? "destructive" : "default"}
                size="sm"
                onClick={() => {
                  onAction();
                }}
                disabled={isPending}
              >
                {isPending ? "Processing..." : actionLabel}
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
