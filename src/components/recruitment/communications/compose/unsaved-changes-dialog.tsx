"use client";

import { AlertDialog } from "@/components/ui/alert-dialog";

export function UnsavedChangesDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog
      isOpen={open}
      onOpenChange={onOpenChange}
      title="Discard unsaved changes?"
      description="You have unsaved edits in this draft. Leave without saving, or save first."
      cancelLabel="Keep editing"
      actionLabel="Discard changes"
      isActionDestructive
      onAction={onConfirm}
    />
  );
}

export function UnsavedSavePrompt({
  open,
  pending,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog
      isOpen={open}
      onOpenChange={onOpenChange}
      title="Save draft before leaving?"
      description="Save your current draft, then return to the Communication Center."
      cancelLabel="Cancel"
      actionLabel={pending ? "Saving…" : "Save & leave"}
      isPending={pending}
      onAction={onConfirm}
    />
  );
}
