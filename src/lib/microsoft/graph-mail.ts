import { graphRequest } from "@/lib/microsoft/graph-client";

export type GraphMailMessage = {
  subject: string;
  body: { contentType: "Text" | "HTML"; content: string };
  toRecipients: { emailAddress: { address: string } }[];
};

/**
 * Foundation for Graph-based mail — Phase 6 uses SMTP email channel by default.
 */
export async function sendMailAsUser(
  userPrincipalName: string,
  message: GraphMailMessage,
  correlationId?: string
) {
  return graphRequest<void>(`/users/${encodeURIComponent(userPrincipalName)}/sendMail`, {
    method: "POST",
    body: { message, saveToSentItems: false },
    correlationId,
  });
}
