import { Button, Text } from "@react-email/components";
import { EnterpriseEmailLayout } from "@/emails/layouts/enterprise-layout";
import { LeaveSummaryCard } from "@/emails/components/leave-summary-card";
import type { LeaveEmailPayload } from "@/lib/notifications/notification-types";

export function LeaveCancelledEmail({ data }: { data: LeaveEmailPayload }) {
  return (
    <EnterpriseEmailLayout preview="Approved leave cancelled" title="Leave cancelled">
      <Text style={p}>An approved leave request has been cancelled by HR. Balances have been restored.</Text>
      <LeaveSummaryCard data={data} />
      <Button href={data.viewUrl} style={button}>
        View details
      </Button>
    </EnterpriseEmailLayout>
  );
}

const p = { color: "#475569", fontSize: "15px", lineHeight: "24px" };
const button = {
  backgroundColor: "#64748b",
  borderRadius: "6px",
  color: "#fff",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: "600",
  marginTop: "8px",
  padding: "12px 20px",
  textDecoration: "none",
};

export default LeaveCancelledEmail;
