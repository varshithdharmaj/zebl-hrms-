import { Text } from "@react-email/components";
import { EnterpriseEmailLayout } from "@/emails/layouts/enterprise-layout";
import { LeaveSummaryCard } from "@/emails/components/leave-summary-card";
import type { LeaveEmailPayload } from "@/lib/notifications/notification-types";

export function LeaveWithdrawnEmail({ data }: { data: LeaveEmailPayload }) {
  return (
    <EnterpriseEmailLayout preview="Leave request withdrawn" title="Leave withdrawn">
      <Text style={p}>A leave request has been withdrawn by the employee.</Text>
      <LeaveSummaryCard data={data} />
    </EnterpriseEmailLayout>
  );
}

const p = { color: "#475569", fontSize: "15px", lineHeight: "24px" };

export default LeaveWithdrawnEmail;
