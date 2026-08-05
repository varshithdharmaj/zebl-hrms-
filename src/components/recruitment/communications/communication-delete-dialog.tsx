"use client";

import { AlertDialog } from "@/components/ui/alert-dialog";

export function CommunicationDeleteDialog({
  open,
  pending,
  subject,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  pending: boolean;
  subject: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog
      isOpen={open}
      onOpenChange={onOpenChange}
      title="Delete draft?"
      description={
        subject
          ? `“${subject}” will be soft-deleted and hidden from the drafts list.`
          : "This draft will be soft-deleted and hidden from the drafts list."
      }
      cancelLabel="Keep draft"
      actionLabel={pending ? "Deleting…" : "Delete draft"}
      isActionDestructive
      isPending={pending}
      onAction={onConfirm}
    />
  );
}
