"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TemplateVariables } from "@/lib/recruitment/communication/template-renderer";
import { EmailPreviewPanel } from "./email-preview-panel";

export function EmailPreviewDialog({
  open,
  onOpenChange,
  subject,
  body,
  recipientEmail,
  additionalRecipients,
  variables,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: string;
  body: string;
  recipientEmail: string;
  additionalRecipients: string[];
  variables: TemplateVariables;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85vh] max-w-2xl overflow-y-auto"
        aria-describedby="email-preview-desc"
      >
        <DialogHeader>
          <DialogTitle>Email preview</DialogTitle>
          <DialogDescription id="email-preview-desc">
            Desktop-style preview with placeholders rendered.
          </DialogDescription>
        </DialogHeader>
        <EmailPreviewPanel
          subject={subject}
          body={body}
          recipientEmail={recipientEmail}
          additionalRecipients={additionalRecipients}
          variables={variables}
        />
      </DialogContent>
    </Dialog>
  );
}
