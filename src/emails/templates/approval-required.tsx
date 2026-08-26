import { Button, Text } from "@react-email/components";
import { EnterpriseEmailLayout } from "@/emails/layouts/enterprise-layout";
import { LeaveSummaryCard } from "@/emails/components/leave-summary-card";
import type { LeaveEmailPayload } from "@/lib/notifications/notification-types";

export function ApprovalRequiredEmail({ data }: { data: LeaveEmailPayload }) {
  return (
    <EnterpriseEmailLayout
      preview={`Approval required: ${data.employeeName}`}
      title="Leave approval required"
    >
      <Text style={p}>
        You have a pending leave request awaiting your review
        {data.approverName ? ` as ${data.approverName}` : ""}.
      </Text>
      <LeaveSummaryCard data={data} />
      {data.approveLink && data.rejectLink ? (
        <>
          <div style={actions}>
            <Button href={data.approveLink} style={approveBtn}>
              Approve
            </Button>
            <Button href={data.rejectLink} style={rejectBtn}>
              Reject
            </Button>
          </div>
          {data.approvalLinkExpiresAt ? (
            <Text style={expire}>
              Secure links expire on{" "}
              {new Date(data.approvalLinkExpiresAt).toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              . You will review and confirm before the action is recorded.
            </Text>
          ) : null}
        </>
      ) : null}
      <Button href={data.viewUrl} style={inboxBtn}>
        Open approval inbox
      </Button>
    </EnterpriseEmailLayout>
  );
}

const p = { color: "#475569", fontSize: "15px", lineHeight: "24px" };
const actions = { marginTop: "16px" };
const approveBtn = {
  backgroundColor: "#059669",
  borderRadius: "6px",
  color: "#fff",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: "600",
  marginRight: "10px",
  padding: "12px 20px",
  textDecoration: "none",
};
const rejectBtn = {
  backgroundColor: "#fff",
  border: "1px solid #dc2626",
  borderRadius: "6px",
  color: "#dc2626",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: "600",
  padding: "12px 20px",
  textDecoration: "none",
};
const expire = { color: "#64748b", fontSize: "12px", lineHeight: "20px", marginTop: "12px" };
const inboxBtn = {
  backgroundColor: "#2563eb",
  borderRadius: "6px",
  color: "#fff",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: "600",
  marginTop: "16px",
  padding: "12px 20px",
  textDecoration: "none",
};

export default ApprovalRequiredEmail;
