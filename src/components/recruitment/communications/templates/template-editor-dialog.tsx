"use client";

import { useEffect, useMemo, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RecruitmentEmailTemplateType } from "@/generated/prisma/enums";
import { TEMPLATE_PLACEHOLDERS } from "@/lib/recruitment/communication/system-templates";
import { renderEmailContent } from "@/lib/recruitment/communication/template-renderer";
import { TEMPLATE_CATEGORIES } from "@/lib/recruitment/communication/template-categories";
import type { TemplateAdminItem } from "./template-workspace";

const SAMPLE_VARIABLES = {
  candidateName: "Ada Lovelace",
  jobTitle: "Software Engineer",
  company: "ZEBL",
  interviewer: "Grace Hopper",
  date: "2026-08-12",
  interviewDate: "2026-08-12",
  time: "10:00 AM",
  location: "Zoom",
  offerSalary: "₹18,00,000",
  offerAmount: "₹18,00,000",
  joiningDate: "2026-09-01",
};

export function TemplateEditorDialog({
  open,
  template,
  onOpenChange,
  onSave,
  pending,
}: {
  open: boolean;
  template: TemplateAdminItem | null;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: {
    name: string;
    type: RecruitmentEmailTemplateType;
    subject: string;
    body: string;
  }) => void;
  pending: boolean;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<RecruitmentEmailTemplateType>(
    RecruitmentEmailTemplateType.general
  );
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName(template?.name ?? "");
    setType(template?.type ?? RecruitmentEmailTemplateType.general);
    setSubject(template?.subject ?? "");
    setBody(template?.body ?? "");
  }, [open, template]);

  const preview = useMemo(
    () => renderEmailContent(subject || " ", body || " ", SAMPLE_VARIABLES),
    [body, subject]
  );

  const insertPlaceholder = (key: string) => {
    setBody((prev) => `${prev}{{${key}}}`);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-full max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-elevated focus:outline-none">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <DialogPrimitive.Title className="text-sm font-semibold">
              {template ? "Edit template" : "Create template"}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button size="sm" variant="ghost" aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </DialogPrimitive.Close>
          </div>

          <div className="grid flex-1 gap-4 overflow-auto p-5 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="tpl-name">Name</Label>
                <Input
                  id="tpl-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-type">Category</Label>
                <select
                  id="tpl-type"
                  className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
                  value={type}
                  onChange={(event) =>
                    setType(event.target.value as RecruitmentEmailTemplateType)
                  }
                >
                  {TEMPLATE_CATEGORIES.map((item) => (
                    <option key={item.id} value={item.type}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-subject">Subject</Label>
                <Input
                  id="tpl-subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-body">Body</Label>
                <Textarea
                  id="tpl-body"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  className="min-h-[14rem]"
                />
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">
                  Placeholder helper
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATE_PLACEHOLDERS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      className="rounded-md border border-border bg-muted/40 px-2 py-1 text-[10px] font-semibold text-foreground hover:bg-muted"
                      onClick={() => insertPlaceholder(key)}
                    >
                      {`{{${key}}}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-border/70 bg-muted/10 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Live preview / test render</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowPreview((value) => !value)}
                >
                  {showPreview ? "Hide" : "Show"}
                </Button>
              </div>
              {showPreview && (
                <div className="space-y-2 text-sm">
                  <p className="font-semibold text-foreground">{preview.subject}</p>
                  <pre className="whitespace-pre-wrap rounded-lg border border-border bg-card p-3 text-xs leading-relaxed text-slate-700">
                    {preview.body}
                  </pre>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={pending || !name.trim() || !subject.trim() || !body.trim()}
              onClick={() =>
                onSave({
                  name: name.trim(),
                  type,
                  subject: subject.trim(),
                  body: body.trim(),
                })
              }
            >
              {pending ? "Saving…" : "Save template"}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
