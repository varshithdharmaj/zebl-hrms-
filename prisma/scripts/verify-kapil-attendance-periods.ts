/**
 * Verifies Kapil multi-session day exists for dashboard period display.
 * Run: npx tsx prisma/scripts/verify-kapil-attendance-periods.ts
 */
import { PrismaClient } from "@/generated/prisma/client";
import {
  mapAttendancePeriods,
  shouldShowAttendancePeriods,
} from "@/lib/attendance/attendance-periods-display";
import { minutesToHours } from "@/lib/utils";

const prisma = new PrismaClient();

function startOfDayLocal(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

async function main() {
  const emp = await prisma.employee.findFirst({
    where: { OR: [{ email: "kapil@zebl.com" }, { employeeCode: "EMP-KAPIL" }] },
    select: { id: true, name: true, employeeCode: true, email: true },
  });

  if (!emp) {
    console.log("KAPIL_NOT_FOUND — run: npx tsx prisma/scripts/seed-kapil.ts");
    process.exit(1);
  }

  const today = startOfDayLocal();
  const tomorrow = startOfDayLocal(new Date(today.getTime() + 24 * 60 * 60 * 1000));

  const dayRecord = await prisma.attendanceRecord.findFirst({
    where: {
      employeeId: emp.id,
      attendanceDate: { gte: today, lt: tomorrow },
    },
    include: {
      sessions: { orderBy: [{ checkIn: "asc" }, { id: "asc" }] },
    },
  });

  if (!dayRecord) {
    console.error("NO_TODAY_RECORD — run: npx tsx prisma/scripts/seed-kapil.ts");
    process.exit(1);
  }

  const sessions = dayRecord.sessions.map((s) => ({
    id: s.id,
    checkIn: s.checkIn,
    checkOut: s.checkOut,
    workedMinutes: s.workedMinutes,
    isOpen: s.checkOut === null,
  }));

  const showPeriods = shouldShowAttendancePeriods(sessions);
  const periods = mapAttendancePeriods(sessions);

  console.log(
    JSON.stringify(
      {
        employee: emp,
        attendanceDate: dayRecord.attendanceDate,
        day: {
          checkIn: dayRecord.checkIn,
          checkOut: dayRecord.checkOut,
          workedMinutes: dayRecord.workedMinutes,
          overtimeMinutes: dayRecord.overtimeMinutes,
          status: dayRecord.status,
          sessions,
        },
        ui: {
          showPeriods,
          periodLabels: periods.map((p) => p.rangeLabel),
          durationLabels: periods.map((p) => p.durationLabel),
          totalWorkedLabel: minutesToHours(dayRecord.workedMinutes),
          overtimeLabel: minutesToHours(dayRecord.overtimeMinutes),
        },
      },
      null,
      2
    )
  );

  const ok =
    showPeriods &&
    dayRecord.workedMinutes === 480 &&
    sessions.length === 2 &&
    sessions[0]?.checkIn === "09:00" &&
    sessions[0]?.checkOut === "12:00" &&
    sessions[0]?.workedMinutes === 180 &&
    sessions[1]?.checkIn === "13:00" &&
    sessions[1]?.checkOut === "18:00" &&
    sessions[1]?.workedMinutes === 300;

  if (!ok) {
    console.error("VERIFICATION_FAILED — run: npx tsx prisma/scripts/seed-kapil.ts");
    process.exit(1);
  }

  console.log("VERIFICATION_OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
