import type { ComposeFormState } from "./compose-types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ComposeValidationResult =
  | { ok: true }
  | { ok: false; error: string };

export function validateComposeForm(
  form: ComposeFormState,
  options?: { requireRecipient?: boolean }
): ComposeValidationResult {
  const requireRecipient = options?.requireRecipient ?? true;

  if (!form.subject.trim()) {
    return { ok: false, error: "Subject is required." };
  }
  if (!form.body.trim()) {
    return { ok: false, error: "Body is required." };
  }
  if (requireRecipient) {
    if (!form.recipientEmail.trim()) {
      return { ok: false, error: "Recipient email is required." };
    }
    if (!EMAIL_RE.test(form.recipientEmail.trim())) {
      return { ok: false, error: "Recipient email is invalid." };
    }
  }

  for (const email of form.additionalRecipients) {
    if (email && !EMAIL_RE.test(email)) {
      return { ok: false, error: `Additional recipient is invalid: ${email}` };
    }
  }

  return { ok: true };
}

export function validateDraftEditable(status: string | null | undefined): ComposeValidationResult {
  if (!status) return { ok: true };
  if (status !== "draft") {
    return { ok: false, error: "Only draft communications can be edited or sent from this workspace." };
  }
  return { ok: true };
}
