import { SectionCard } from "@/components/ui/section-card";
import { AttendanceLineChart } from "@/components/ui/attendance-line-chart";
import type { AttendanceDayCategory, AttendanceRatioTier } from "@/lib/attendance/day-classification";

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
    category: AttendanceDayCategory;
    ratioTier: AttendanceRatioTier | null;
  }[];
  action?: React.ReactNode;
}) {
  return (
    <SectionCard title={title} description={description} action={action}>
      <AttendanceLineChart records={records} />
    </SectionCard>
  );
}
