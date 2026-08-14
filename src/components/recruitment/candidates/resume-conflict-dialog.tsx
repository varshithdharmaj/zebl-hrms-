"use client";

import React, { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertTriangle, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ConflictField = {
  key: string;
  label: string;
  currentValue: string;
  parsedValue: string;
};

export interface ResumeConflictDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: ConflictField[];
  onResolve: (resolutions: Record<string, string>) => void;
  /** Parent merge/apply in flight — keep dialog open and block re-submit. */
  isPending?: boolean;
}

export function ResumeConflictDialog({
  isOpen,
  onOpenChange,
  conflicts,
  onResolve,
  isPending = false,
}: ResumeConflictDialogProps) {
  // Store selected value per conflict key: "current" or "parsed"
  const [selections, setSelections] = useState<Record<string, "current" | "parsed">>(
    () => Object.fromEntries(conflicts.map((c) => [c.key, "current"]))
  );

  // Reset selections when conflicts change
  useEffect(() => {
    setSelections(Object.fromEntries(conflicts.map((c) => [c.key, "current"])));
  }, [conflicts]);

  function handleSelect(key: string, choice: "current" | "parsed") {
    if (isPending) return;
    setSelections((prev) => ({ ...prev, [key]: choice }));
  }

  function handleApply() {
    if (isPending) return;
    const resolutions: Record<string, string> = {};
    for (const conflict of conflicts) {
      const choice = selections[conflict.key] ?? "current";
      resolutions[conflict.key] =
        choice === "current" ? conflict.currentValue : conflict.parsedValue;
    }
    onResolve(resolutions);
  }

  return (
    <DialogPrimitive.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && isPending) return;
        onOpenChange(open);
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm transition-opacity" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-elevated focus:outline-none flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border pb-4 shrink-0">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 border border-amber-200 text-amber-600 dark:bg-amber-500/10 dark:border-amber-900/30 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-foreground">Resolve Resume Conflicts</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Some parsed details differ from what you already typed. Choose which to keep.
                </p>
              </div>
            </div>
            <DialogPrimitive.Close asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                disabled={isPending}
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogPrimitive.Close>
          </div>

          {/* Conflict List */}
          <div className="space-y-4 py-4 overflow-auto max-h-[50vh] pr-1">
            <div className="divide-y divide-border/40 border border-border rounded-xl bg-muted/5 overflow-hidden">
              {conflicts.map((conflict) => {
                const currentSelected = selections[conflict.key] === "current";
                const parsedSelected = selections[conflict.key] === "parsed";

                return (
                  <div key={conflict.key} className="p-4 space-y-2.5">
                    <span className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      {conflict.label}
                    </span>
                    
                    <div className="grid gap-3 sm:grid-cols-2">
                      {/* Current Typed Value Option */}
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleSelect(conflict.key, "current")}
                        className={`flex flex-col items-start p-3 rounded-lg border text-left transition-all disabled:opacity-60 disabled:pointer-events-none ${
                          currentSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border bg-card hover:bg-muted/15"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            What you typed
                          </span>
                          {currentSelected && (
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-medium text-foreground mt-1.5 break-all">
                          {conflict.currentValue || <em className="text-muted-foreground/60">Empty</em>}
                        </span>
                      </button>

                      {/* Parsed Resume Value Option */}
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleSelect(conflict.key, "parsed")}
                        className={`flex flex-col items-start p-3 rounded-lg border text-left transition-all disabled:opacity-60 disabled:pointer-events-none ${
                          parsedSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border bg-card hover:bg-muted/15"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            Found in Resume
                          </span>
                          {parsedSelected && (
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-medium text-foreground mt-1.5 break-all">
                          {conflict.parsedValue || <em className="text-muted-foreground/60">Empty</em>}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 border-t border-border pt-4 shrink-0">
            <DialogPrimitive.Close asChild>
              <Button variant="outline" size="sm" disabled={isPending}>
                Cancel
              </Button>
            </DialogPrimitive.Close>
            <Button
              size="sm"
              onClick={handleApply}
              loading={isPending}
              className="font-semibold shadow-subtle"
            >
              {isPending ? "Applying…" : "Resolve & Merge"}
            </Button>
          </div>

        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
