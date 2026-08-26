import { Section, Text } from "@react-email/components";
import type { LeaveEmailPayload } from "@/lib/notifications/notification-types";

export function LeaveSummaryCard({ data }: { data: LeaveEmailPayload }) {
  return (
    <Section style={card}>
      <Text style={row}>
        <strong>Employee:</strong> {data.employeeName} ({data.employeeCode})
      </Text>
      <Text style={row}>
        <strong>Leave type:</strong> {data.leaveType}
      </Text>
      <Text style={row}>
        <strong>Dates:</strong> {data.startDate} – {data.endDate}
      </Text>
      <Text style={row}>
        <strong>Duration:</strong> {data.days} day(s)
      </Text>
      <Text style={row}>
        <strong>Status:</strong> {data.workflowStatus.replace(/_/g, " ")}
      </Text>
      <Text style={row}>
        <strong>Reason:</strong> {data.reason}
      </Text>
      {data.rejectionReason && (
        <Text style={rejectRow}>
          <strong>Comment:</strong> {data.rejectionReason}
        </Text>
      )}
    </Section>
  );
}

const card = {
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "6px",
  padding: "16px",
  margin: "16px 0",
};

const row = { color: "#334155", fontSize: "14px", lineHeight: "22px", margin: "0 0 6px" };
const rejectRow = { color: "#b91c1c", fontSize: "14px", lineHeight: "22px", margin: "8px 0 0" };
