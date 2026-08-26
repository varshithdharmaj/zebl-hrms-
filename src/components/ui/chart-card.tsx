import { SectionCard } from "@/components/ui/section-card";
import { AttendanceLineChart } from "@/components/ui/attendance-line-chart";

export function ChartCard({
  title = "Attendance trend",
  description,
  records,
  action,
}: {
  title?: string;
  description?: string;
  records: {
    attendanceDate: Date;
    workedMinutes: number;
    status: string;
  }[];
  action?: React.ReactNode;
}) {
  return (
    <SectionCard title={title} description={description} action={action}>
      <AttendanceLineChart records={records} />
    </SectionCard>
  );
}
