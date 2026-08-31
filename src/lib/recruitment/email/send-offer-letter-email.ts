import { getTransporter } from "@/lib/notifications/channels/email-channel";

export type SendOfferLetterEmailInput = {
  recipientEmail: string;
  candidateName: string;
  designation: string;
  fileName: string;
  pdfContent: Buffer;
};

export type SendOfferLetterEmailResult =
  | { success: true; providerMessageId: string }
  | { success: false; error: string };

function buildBody(candidateName: string, designation: string): { html: string; text: string } {
  const greeting = `Dear ${candidateName},`;
  const body =
    `We are pleased to share your offer letter for the role of ${designation} at ZEBL India Private Limited. ` +
    `Please find the offer letter and salary annexure attached as a PDF. ` +
    `Kindly review the terms and conditions carefully and follow the instructions in the letter to confirm your acceptance.`;
  const signoff = "Regards,\nHR Team\nZEBL India Private Limited";

  const text = `${greeting}\n\n${body}\n\n${signoff}`;
  const html = `<p>${greeting}</p><p>${body}</p><p>${signoff.replace(/\n/g, "<br/>")}</p>`;
  return { html, text };
}

/**
 * Sends the generated offer letter PDF directly to the candidate, bypassing the
 * generic notification queue: delivery success/failure must be known synchronously
 * so the caller can decide whether the offer is actually "sent" (queued
 * notifications only report success-at-enqueue, not success-at-delivery).
 */
export async function sendOfferLetterEmail(
  input: SendOfferLetterEmailInput
): Promise<SendOfferLetterEmailResult> {
  const transport = getTransporter();
  if (!transport) {
    if (process.env.NODE_ENV === "development") {
      return { success: true, providerMessageId: "dev-skip" };
    }
    return { success: false, error: "SMTP is not configured." };
  }

  const { html, text } = buildBody(input.candidateName, input.designation);
  const from = process.env.EMAIL_FROM ?? "HRMS <noreply@zebl.local>";

  try {
    const result = await transport.sendMail({
      from,
      to: input.recipientEmail,
      subject: `Your Offer Letter — ${input.designation} at ZEBL India Private Limited`,
      html,
      text,
      attachments: [
        {
          filename: input.fileName,
          content: input.pdfContent,
          contentType: "application/pdf",
        },
      ],
    });
    return { success: true, providerMessageId: result.messageId };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Email send failed.";
    return { success: false, error: message };
  }
}
