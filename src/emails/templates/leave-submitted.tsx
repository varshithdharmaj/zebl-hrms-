import { Button, Text } from "@react-email/components";
import { EnterpriseEmailLayout } from "@/emails/layouts/enterprise-layout";
import { LeaveSummaryCard } from "@/emails/components/leave-summary-card";
import type { LeaveEmailPayload } from "@/lib/notifications/notification-types";

export function LeaveSubmittedEmail({ data }: { data: LeaveEmailPayload }) {
  return (
    <EnterpriseEmailLayout
      preview={`${data.employeeName} submitted a leave request`}
      title="New leave request submitted"
    >
      <Text style={p}>A new leave request requires your attention.</Text>
      <LeaveSummaryCard data={data} />
      <Button href={data.viewUrl} style={button}>
        View in AMS
      </Button>
    </EnterpriseEmailLayout>
  );
}

const p = { color: "#475569", fontSize: "15px", lineHeight: "24px" };
const button = {
  backgroundColor: "#2563eb",
  borderRadius: "6px",
  color: "#fff",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: "600",
  marginTop: "8px",
  padding: "12px 20px",
  textDecoration: "none",
};

export default LeaveSubmittedEmail;
