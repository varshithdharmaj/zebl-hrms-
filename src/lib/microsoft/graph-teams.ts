import { createHmac, timingSafeEqual } from "crypto";
import type { LeaveEmailPayload } from "@/lib/notifications/notification-types";

export type TeamsMessageCard = {
  "@type": "MessageCard";
  "@context": "http://schema.org/extensions";
  themeColor: string;
  summary: string;
  title: string;
  sections: {
    activityTitle?: string;
    facts: { name: string; value: string }[];
    text?: string;
  }[];
  potentialAction?: TeamsCardAction[];
};

export type TeamsCardAction = {
  "@type": "OpenUri" | "HttpPOST";
  name: string;
  targets?: { os: string; uri: string }[];
  target?: string;
  body?: string;
  headers?: { name: string; value: string }[];
};

export function buildApprovalAdaptiveCard(payload: LeaveEmailPayload): TeamsMessageCard {
  const facts = [
    { name: "Employee", value: `${payload.employeeName} (${payload.employeeCode})` },
    { name: "Leave type", value: payload.leaveType },
    { name: "Dates", value: `${payload.startDate} — ${payload.endDate}` },
    { name: "Days", value: String(payload.days) },
    { name: "Reason", value: payload.reason },
  ];

  const actions: TeamsCardAction[] = [];
  if (payload.approveLink) {
    actions.push({
      "@type": "OpenUri",
      name: "Approve",
      targets: [{ os: "default", uri: payload.approveLink }],
    });
  }
  if (payload.rejectLink) {
    actions.push({
      "@type": "OpenUri",
      name: "Reject",
      targets: [{ os: "default", uri: payload.rejectLink }],
    });
  }
  actions.push({
    "@type": "OpenUri",
    name: "Open in AMS",
    targets: [{ os: "default", uri: payload.viewUrl }],
  });

  return {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    themeColor: "2563EB",
    summary: `Approval required: ${payload.employeeName}`,
    title: "Zebl AMS — Leave approval required",
    sections: [
      {
        activityTitle: payload.approverName ?? "Approver",
        facts,
        text: payload.approvalLinkExpiresAt
          ? `Secure approval links expire ${new Date(payload.approvalLinkExpiresAt).toLocaleString("en-IN")}.`
          : undefined,
      },
    ],
    potentialAction: actions,
  };
}

export function buildStatusAdaptiveCard(
  payload: LeaveEmailPayload,
  title: string
): TeamsMessageCard {
  return {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    themeColor: "059669",
    summary: title,
    title: `Zebl AMS — ${title}`,
    sections: [
      {
        facts: [
          { name: "Employee", value: payload.employeeName },
          { name: "Leave", value: `${payload.leaveType} (${payload.startDate} — ${payload.endDate})` },
          { name: "Status", value: payload.workflowStatus },
        ],
      },
    ],
    potentialAction: [
      {
        "@type": "OpenUri",
        name: "View",
        targets: [{ os: "default", uri: payload.viewUrl }],
      },
    ],
  };
}

export async function postToTeamsWebhook(
  webhookUrl: string,
  card: TeamsMessageCard
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { success: false, error: text.slice(0, 300) || res.statusText };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Teams webhook failed" };
  }
}

export function signTeamsCallback(body: string, timestamp: string): string {
  const secret = process.env.TEAMS_CALLBACK_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("Missing TEAMS_CALLBACK_SECRET or AUTH_SECRET for Teams callback signature");
  }
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function verifyTeamsCallbackSignature(
  body: string,
  timestamp: string,
  signature: string
): boolean {
  const expected = signTeamsCallback(body, timestamp);
  try {
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
