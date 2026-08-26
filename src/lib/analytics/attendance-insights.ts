import { prisma } from "@/lib/prisma";
import type { DateRange } from "@/lib/analytics/analytics-types";

export type AttendanceInsightSummary = {
  attendanceRate: number;
  absenteeismRate: number;
  punctualityRate: number;
  overtimeTrend: { week: string; avgMinutes: number }[];
  byDepartment: { department: string; attendanceRate: number; absentRate: number }[];
};

function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 1000) / 10 : 0;
}

export async function buildAttendanceInsights(range: DateRange): Promise<AttendanceInsightSummary> {
  const records = await prisma.attendanceRecord.findMany({
    where: { attendanceDate: { gte: range.start, lte: range.end } },
    include: { employee: { select: { department: true } } },
  });

  const total = records.length;
  const present = records.filter((r) => r.status === "Present").length;
  const absent = records.filter((r) => r.status === "Absent").length;
  const shortHours = records.filter((r) => r.status === "Short Hours").length;

  const weekMap = new Map<string, { ot: number; n: number }>();
  for (const r of records) {
    const wk = r.attendanceDate.toISOString().slice(0, 10);
    const entry = weekMap.get(wk) ?? { ot: 0, n: 0 };
    entry.ot += r.overtimeMinutes;
    entry.n += 1;
    weekMap.set(wk, entry);
  }

  const deptMap = new Map<string, { present: number; absent: number; total: number }>();
  for (const r of records) {
    const dept = r.employee.department ?? "Unassigned";
    const d = deptMap.get(dept) ?? { present: 0, absent: 0, total: 0 };
    d.total += 1;
    if (r.status === "Present") d.present += 1;
    if (r.status === "Absent") d.absent += 1;
    deptMap.set(dept, d);
  }

  return {
    attendanceRate: pct(present + shortHours, total),
    absenteeismRate: pct(absent, total),
    punctualityRate: pct(present, total),
    overtimeTrend: [...weekMap.entries()]
      .slice(-8)
      .map(([week, v]) => ({ week, avgMinutes: Math.round(v.ot / v.n) })),
    byDepartment: [...deptMap.entries()].map(([department, v]) => ({
      department,
      attendanceRate: pct(v.present, v.total),
      absentRate: pct(v.absent, v.total),
    })),
  };
}
