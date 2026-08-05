"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createDraftAction,
  updateDraftAction,
  sendMessageAction,
  scheduleMessageAction,
  deleteDraftAction,
} from "@/actions/recruitment-communications";
import {
  findSystemTemplate,
  isSystemTemplateId,
  type ComposeTemplateOption,
} from "@/lib/recruitment/communication/system-templates";
import { renderEmailContent } from "@/lib/recruitment/communication/template-renderer";
import { CommunicationDeleteDialog } from "../communication-delete-dialog";
import { ComposeHeader } from "./compose-header";
import { ComposeEditor } from "./compose-editor";
import { ComposeFooter } from "./compose-footer";
import { RecipientSelector } from "./recipient-selector";
import { TemplateSelector } from "./template-selector";
import { TemplateVariablePanel } from "./template-variable-panel";
import { PlaceholderPreview } from "./placeholder-preview";
import { EmailPreviewDialog } from "./email-preview-dialog";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog";
import { validateComposeForm, validateDraftEditable } from "./compose-validation";
import { AttachmentList } from "../attachments/attachment-list";
import { AttachmentUploader } from "../attachments/attachment-uploader";
import type { CommunicationAttachmentView } from "../types";
import {
  EMPTY_VARIABLES,
  type AutosaveStatus,
  type ComposeDraftInitial,
  type ComposeFormState,
  type ComposePageData,
  type ComposePrefill,
  type ComposeRecipientOption,
} from "./compose-types";

function buildInitialForm(
  companyName: string,
  draft?: ComposeDraftInitial | null,
  prefill?: ComposePrefill | null
): ComposeFormState {
  const meta = draft?.metadata ?? {};
  const variablesFromMeta =
    typeof meta.templateVariables === "object" && meta.templateVariables !== null
      ? (meta.templateVariables as Record<string, string>)
      : {};

  const prefillSystemTemplate =
    prefill?.systemTemplateId && isSystemTemplateId(prefill.systemTemplateId)
      ? findSystemTemplate(prefill.systemTemplateId)
      : null;

  const resolvedSystemTemplateId =
    typeof meta.systemTemplateId === "string"
      ? meta.systemTemplateId
      : isSystemTemplateId(draft?.templateId)
        ? draft?.templateId ?? null
        : prefillSystemTemplate?.id ?? null;

  return {
    draftId: draft?.id ?? null,
    subject:
      draft?.subject ??
      prefill?.subject ??
      prefillSystemTemplate?.subject ??
      "",
    body: draft?.body ?? prefill?.body ?? prefillSystemTemplate?.body ?? "",
    recipientEmail: draft?.recipientEmail ?? prefill?.recipientEmail ?? "",
    additionalRecipients: Array.isArray(meta.additionalRecipients)
      ? (meta.additionalRecipients as string[]).filter((value) => typeof value === "string")
      : [],
    candidateId: draft?.candidateId ?? prefill?.candidateId ?? null,
    applicationId: draft?.applicationId ?? prefill?.applicationId ?? null,
    jobOpeningId: draft?.jobOpeningId ?? prefill?.jobOpeningId ?? null,
    interviewId: draft?.interviewId ?? prefill?.interviewId ?? null,
    offerId: draft?.offerId ?? prefill?.offerId ?? null,
    templateId: draft?.templateId && !isSystemTemplateId(draft.templateId) ? draft.templateId : null,
    systemTemplateId: resolvedSystemTemplateId,
    parentId: prefill?.parentId ?? null,
    threadId: prefill?.threadId ?? null,
    variables: {
      ...EMPTY_VARIABLES,
      company: companyName,
      ...variablesFromMeta,
    },
  };
}

export function ComposeWorkspace({
  data,
}: {
  data: ComposePageData;
}) {
  const router = useRouter();
  const [form, setForm] = useState<ComposeFormState>(() =>
    buildInitialForm(data.companyName, data.initialDraft, data.prefill)
  );
  const [attachments, setAttachments] = useState<CommunicationAttachmentView[]>(
    () => data.initialDraft?.attachments ?? []
  );
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>(() => {
    const candidateId = data.initialDraft?.candidateId ?? data.prefill?.candidateId;
    if (!candidateId) return [];
    const match = data.recipients.find(
      (option) => option.kind === "candidate" && option.candidateId === candidateId
    );
    return match ? [match.id] : [];
  });
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"success" | "error">("success");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextAutosave = useRef(false);
  const draftStatus = data.initialDraft?.status ?? "draft";

  const selectedTemplateId = form.systemTemplateId ?? form.templateId;

  const markDirty = useCallback(() => {
    setDirty(true);
    setAutosaveStatus("idle");
  }, []);

  const updateForm = useCallback(
    (patch: Partial<ComposeFormState>) => {
      setForm((prev) => ({ ...prev, ...patch }));
      markDirty();
    },
    [markDirty]
  );

  const persistDraft = useCallback(
    async (mode: "autosave" | "manual" = "manual"): Promise<string | null> => {
      const editable = validateDraftEditable(form.draftId ? draftStatus : "draft");
      if (!editable.ok) {
        setStatusTone("error");
        setStatusMessage(editable.error);
        return null;
      }

      const validation = validateComposeForm(form, { requireRecipient: false });
      if (!validation.ok) {
        if (mode === "manual") {
          setStatusTone("error");
          setStatusMessage(validation.error);
        }
        return null;
      }

      if (mode === "autosave") setAutosaveStatus("saving");

      const payload = {
        subject: form.subject.trim(),
        body: form.body.trim(),
        recipientEmail: form.recipientEmail.trim() || null,
        candidateId: form.candidateId,
        applicationId: form.applicationId,
        jobOpeningId: form.jobOpeningId,
        interviewId: form.interviewId,
        offerId: form.offerId,
        templateId: form.templateId,
        parentId: form.parentId,
        threadId: form.threadId,
        metadata: {
          systemTemplateId: form.systemTemplateId,
          additionalRecipients: form.additionalRecipients,
          templateVariables: form.variables,
        },
      };

      const result = form.draftId
        ? await updateDraftAction({}, { id: form.draftId, ...payload })
        : await createDraftAction({}, payload);

      if (result.error) {
        if (mode === "autosave") setAutosaveStatus("error");
        setStatusTone("error");
        setStatusMessage(result.error);
        return null;
      }

      const id = result.communicationId ?? form.draftId;
      if (id && !form.draftId) {
        setForm((prev) => ({ ...prev, draftId: id }));
        skipNextAutosave.current = true;
        router.replace(`/admin/recruitment/communications/drafts/${id}`);
      }

      setDirty(false);
      if (mode === "autosave") setAutosaveStatus("saved");
      if (mode === "manual") {
        setStatusTone("success");
        setStatusMessage(result.success ?? "Draft saved.");
      }
      return id ?? null;
    },
    [draftStatus, form, router]
  );

  useEffect(() => {
    if (!dirty || skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return;
    }
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      void persistDraft("autosave");
    }, 1600);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [dirty, form.subject, form.body, form.recipientEmail, persistDraft]);

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "s") {
        event.preventDefault();
        startTransition(() => {
          void persistDraft("manual");
        });
      }
      if (meta && event.key === "Enter") {
        event.preventDefault();
        handleSend();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, dirty]);

  const handleTemplateChange = useCallback(
    (template: ComposeTemplateOption | null) => {
      if (!template) {
        updateForm({ templateId: null, systemTemplateId: null });
        return;
      }
      updateForm({
        subject: template.subject,
        body: template.body,
        templateId: template.isSystem ? null : template.id,
        systemTemplateId: template.isSystem ? template.id : null,
      });
    },
    [updateForm]
  );

  const handleToggleRecipient = useCallback(
    (option: ComposeRecipientOption) => {
      setSelectedRecipientIds((prev) => {
        const exists = prev.includes(option.id);
        return exists ? prev.filter((id) => id !== option.id) : [...prev, option.id];
      });

      const nextEmail = option.email ?? form.recipientEmail;
      const nextAdditional = new Set(form.additionalRecipients);
      if (option.email && option.email !== nextEmail) {
        nextAdditional.add(option.email);
      }

      updateForm({
        recipientEmail: nextEmail,
        additionalRecipients: [...nextAdditional],
        candidateId: option.candidateId ?? form.candidateId,
        applicationId: option.applicationId ?? form.applicationId,
        jobOpeningId: option.jobOpeningId ?? form.jobOpeningId,
        interviewId: option.interviewId ?? form.interviewId,
        offerId: option.offerId ?? form.offerId,
        variables: {
          ...form.variables,
          ...option.variables,
          company: form.variables.company || data.companyName,
        },
      });
    },
    [data.companyName, form, updateForm]
  );

  const canSend = useMemo(() => validateComposeForm(form).ok, [form]);

  function handleBack() {
    if (dirty) {
      setUnsavedOpen(true);
      return;
    }
    router.push("/admin/recruitment/communications?tab=drafts");
  }

  function handleSchedule() {
    const editable = validateDraftEditable(form.draftId ? draftStatus : "draft");
    if (!editable.ok) {
      setStatusTone("error");
      setStatusMessage(editable.error);
      return;
    }
    const validation = validateComposeForm(form);
    if (!validation.ok) {
      setStatusTone("error");
      setStatusMessage(validation.error);
      return;
    }

    const raw = window.prompt(
      "Schedule send time (local). Example: 2026-08-12T15:30",
      new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)
    );
    if (!raw) return;
    const scheduledFor = new Date(raw).toISOString();
    if (Number.isNaN(new Date(scheduledFor).getTime())) {
      setStatusTone("error");
      setStatusMessage("Invalid schedule date/time.");
      return;
    }

    startTransition(async () => {
      const rendered = renderEmailContent(form.subject, form.body, form.variables);
      const result = await scheduleMessageAction(
        {},
        {
          id: form.draftId ?? undefined,
          scheduledFor,
          subject: rendered.subject,
          body: rendered.body,
          recipientEmail: form.recipientEmail.trim(),
          candidateId: form.candidateId,
          applicationId: form.applicationId,
          jobOpeningId: form.jobOpeningId,
          interviewId: form.interviewId,
          offerId: form.offerId,
          templateId: form.templateId,
        }
      );
      if (result.error) {
        setStatusTone("error");
        setStatusMessage(result.error);
        return;
      }
      setDirty(false);
      setStatusTone("success");
      setStatusMessage(result.success ?? "Message scheduled.");
      router.push("/admin/recruitment/communications?tab=scheduled");
      router.refresh();
    });
  }

  function handleSend() {
    const editable = validateDraftEditable(form.draftId ? draftStatus : "draft");
    if (!editable.ok) {
      setStatusTone("error");
      setStatusMessage(editable.error);
      return;
    }
    const validation = validateComposeForm(form);
    if (!validation.ok) {
      setStatusTone("error");
      setStatusMessage(validation.error);
      return;
    }

    startTransition(async () => {
      const rendered = renderEmailContent(form.subject, form.body, form.variables);
      const result = await sendMessageAction(
        {},
        {
          id: form.draftId ?? undefined,
          subject: rendered.subject,
          body: rendered.body,
          recipientEmail: form.recipientEmail.trim(),
          candidateId: form.candidateId,
          applicationId: form.applicationId,
          jobOpeningId: form.jobOpeningId,
          interviewId: form.interviewId,
          offerId: form.offerId,
          templateId: form.templateId,
          templateVariables: Object.fromEntries(
            Object.entries(form.variables).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string"
            )
          ),
          metadata: {
            systemTemplateId: form.systemTemplateId,
            additionalRecipients: form.additionalRecipients,
          },
        }
      );

      if (result.error) {
        setStatusTone("error");
        setStatusMessage(result.error);
        return;
      }

      setDirty(false);
      setStatusTone("success");
      setStatusMessage(result.success ?? "Message sent.");
      router.push("/admin/recruitment/communications?tab=sent");
      router.refresh();
    });
  }

  function handleDiscardConfirm() {
    if (!form.draftId) {
      setDirty(false);
      router.push("/admin/recruitment/communications?tab=drafts");
      return;
    }
    startTransition(async () => {
      const result = await deleteDraftAction({}, { id: form.draftId });
      if (result.error) {
        setStatusTone("error");
        setStatusMessage(result.error);
        return;
      }
      setDirty(false);
      setDiscardOpen(false);
      router.push("/admin/recruitment/communications?tab=drafts");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <ComposeHeader
        title={form.draftId ? "Edit draft" : "Compose email"}
        autosaveStatus={isPending ? "saving" : autosaveStatus}
        onBack={handleBack}
      />

      {statusMessage && (
        <div
          role="status"
          className={
            statusTone === "error"
              ? "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              : "rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700"
          }
        >
          {statusMessage}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <TemplateSelector
            templates={data.templates}
            value={selectedTemplateId}
            onChange={handleTemplateChange}
          />
          <ComposeEditor
            subject={form.subject}
            body={form.body}
            onSubjectChange={(subject) => updateForm({ subject })}
            onBodyChange={(body) => updateForm({ body })}
            onUndoWarning={() => {
              setStatusTone("error");
              setStatusMessage("Browser undo may discard unsaved edits. Save your draft first (Ctrl/Cmd+S).");
            }}
          />
          <PlaceholderPreview
            subject={form.subject}
            body={form.body}
            variables={form.variables}
          />

          <section
            className="rounded-xl border border-border/70 bg-card p-4 space-y-3"
            aria-label="Attachments"
          >
            <h3 className="text-sm font-semibold text-foreground">Attachments</h3>
            {!form.draftId ? (
              <p className="text-xs text-muted-foreground">
                Save the draft once to enable attachment uploads.
              </p>
            ) : (
              <>
                <AttachmentUploader
                  communicationId={form.draftId}
                  onUploaded={(attachment) => {
                    setAttachments((prev) => {
                      if (prev.some((item) => item.id === attachment.id)) return prev;
                      return [attachment, ...prev];
                    });
                    router.refresh();
                  }}
                />
                <AttachmentList
                  attachments={attachments}
                  canRemove
                  onChanged={(attachmentId) => {
                    if (attachmentId) {
                      setAttachments((prev) =>
                        prev.filter((item) => item.id !== attachmentId)
                      );
                    }
                    router.refresh();
                  }}
                />
              </>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <RecipientSelector
            options={data.recipients}
            selectedIds={selectedRecipientIds}
            manualEmail={form.recipientEmail}
            onToggleOption={handleToggleRecipient}
            onManualEmailChange={(recipientEmail) => updateForm({ recipientEmail })}
          />
          <TemplateVariablePanel
            variables={form.variables}
            onChange={(key, value) =>
              updateForm({
                variables: {
                  ...form.variables,
                  [key]: value,
                },
              })
            }
          />
        </div>
      </div>

      <ComposeFooter
        canSend={canSend}
        pending={isPending}
        hasDraft={Boolean(form.draftId) || dirty}
        onPreview={() => setPreviewOpen(true)}
        onSave={() =>
          startTransition(() => {
            void persistDraft("manual");
          })
        }
        onSend={handleSend}
        onSchedule={handleSchedule}
        onDiscard={() => setDiscardOpen(true)}
      />

      <EmailPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        subject={form.subject}
        body={form.body}
        recipientEmail={form.recipientEmail}
        additionalRecipients={form.additionalRecipients}
        variables={form.variables}
      />

      <UnsavedChangesDialog
        open={unsavedOpen}
        onOpenChange={setUnsavedOpen}
        onConfirm={() => {
          setDirty(false);
          setUnsavedOpen(false);
          router.push("/admin/recruitment/communications?tab=drafts");
        }}
      />

      <CommunicationDeleteDialog
        open={discardOpen}
        pending={isPending}
        subject={form.subject || "Untitled draft"}
        onOpenChange={setDiscardOpen}
        onConfirm={handleDiscardConfirm}
      />

      <p className="sr-only" aria-live="polite">
        Keyboard shortcuts: Control or Command S to save, Control or Command Enter to send.
      </p>
    </div>
  );
}
