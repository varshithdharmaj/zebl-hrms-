import { Button, Text } from "@react-email/components";
import { EnterpriseEmailLayout } from "@/emails/layouts/enterprise-layout";
import { LeaveSummaryCard } from "@/emails/components/leave-summary-card";
import type { LeaveEmailPayload } from "@/lib/notifications/notification-types";

export function LeaveApprovedEmail({ data }: { data: LeaveEmailPayload }) {
  return (
    <EnterpriseEmailLayout preview="Your leave request was approved" title="Leave approved">
      <Text style={p}>Your leave request has been fully approved.</Text>
      <LeaveSummaryCard data={data} />
      <Button href={data.viewUrl} style={button}>
        View leave details
      </Button>
    </EnterpriseEmailLayout>
  );
}

const p = { color: "#475569", fontSize: "15px", lineHeight: "24px" };
const button = {
  backgroundColor: "#16a34a",
  borderRadius: "6px",
  color: "#fff",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: "600",
  marginTop: "8px",
  padding: "12px 20px",
  textDecoration: "none",
};

export default LeaveApprovedEmail;
