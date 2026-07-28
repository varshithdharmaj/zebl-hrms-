import { PrismaClient } from "@/generated/prisma/client";

const prisma = new PrismaClient();

function startOfDayLocal(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Seven check-in / check-out periods for today (sum = 480m). */
const TODAY_SESSIONS = [
  { checkIn: "09:00", checkOut: "10:00", workedMinutes: 60 },
  { checkIn: "10:15", checkOut: "11:00", workedMinutes: 45 },
  { checkIn: "11:15", checkOut: "12:15", workedMinutes: 60 },
  { checkIn: "13:00", checkOut: "14:00", workedMinutes: 60 },
  { checkIn: "14:15", checkOut: "15:15", workedMinutes: 60 },
  { checkIn: "15:30", checkOut: "16:45", workedMinutes: 75 },
  { checkIn: "17:00", checkOut: "19:00", workedMinutes: 120 },
] as const;

async function main() {
  const employee = await prisma.employee.findFirst({
    where: {
      OR: [
        { employeeCode: "EMP-JDOE" },
        { name: { equals: "John Doe", mode: "insensitive" } },
      ],
    },
  });

  if (!employee) {
    throw new Error("John Doe (EMP-JDOE) not found");
  }

  const today = startOfDayLocal();
  const workedMinutes = TODAY_SESSIONS.reduce((sum, s) => sum + s.workedMinutes, 0);
  const checkIn = TODAY_SESSIONS[0].checkIn;
  const checkOut = TODAY_SESSIONS[TODAY_SESSIONS.length - 1].checkOut;
  const overtimeMinutes = Math.max(0, workedMinutes - 480);

  const record = await prisma.attendanceRecord.upsert({
    where: {
      employeeId_attendanceDate: {
        employeeId: employee.id,
        attendanceDate: today,
      },
    },
    create: {
      employeeId: employee.id,
      attendanceDate: today,
      shift: "Morning Shift",
      checkIn,
      checkOut,
      workDuration: duration(workedMinutes),
      workedMinutes,
      overtimeMinutes,
      status: workedMinutes >= 480 ? "Present" : "Short Hours",
      remarks: "Multi-session seed · 7 check-in/out periods",
    },
    update: {
      shift: "Morning Shift",
      checkIn,
      checkOut,
      workDuration: duration(workedMinutes),
      workedMinutes,
      overtimeMinutes,
      status: workedMinutes >= 480 ? "Present" : "Short Hours",
      remarks: "Multi-session seed · 7 check-in/out periods",
    },
  });

  await prisma.attendanceSession.deleteMany({ where: { attendanceId: record.id } });
  await prisma.attendanceSession.createMany({
    data: TODAY_SESSIONS.map((s) => ({
      attendanceId: record.id,
      checkIn: s.checkIn,
      checkOut: s.checkOut,
      workedMinutes: s.workedMinutes,
    })),
  });

  const sessions = await prisma.attendanceSession.findMany({
    where: { attendanceId: record.id },
    orderBy: [{ checkIn: "asc" }, { id: "asc" }],
  });

  console.log(
    JSON.stringify(
      {
        employeeId: employee.id,
        employeeCode: employee.employeeCode,
        name: employee.name,
        today: today.toISOString().slice(0, 10),
        record: {
          id: record.id,
          checkIn,
          checkOut,
          workedMinutes,
          overtimeMinutes,
          status: workedMinutes >= 480 ? "Present" : "Short Hours",
          sessionCount: sessions.length,
        },
        sessions: sessions.map((s) => ({
          checkIn: s.checkIn,
          checkOut: s.checkOut,
          workedMinutes: s.workedMinutes,
        })),
      },
      null,
      2
    )
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
