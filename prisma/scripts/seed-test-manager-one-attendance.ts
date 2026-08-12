/**
 * Idempotent seed: 60 days of attendance for Test Manager One (TEST-MGR-01),
 * covering every heatmap color / classifier outcome, including today's multi-session logins.
 *
 * Run: npm run db:seed:test-manager-one-attendance
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  LeaveRequestStatus,
  LeaveWorkflowStatus,
  PrismaClient,
} from "@/generated/prisma/client";
import { RECRUITMENT_TEST_MANAGER_EMPLOYEE_CODES } from "@/lib/recruitment/permissions/recruitment-test-manager";

function loadEnvFile(filename: string): void {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

function createPrismaClient(): PrismaClient {
  const url = (process.env.DATABASE_URL || process.env.DIRECT_URL || "").trim();
  if (!url) {
    throw new Error("DATABASE_URL (or DIRECT_URL) is not set.");
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: url, maxUses: 1 }),
    log: ["error", "warn"],
  });
}

const EMP_CODE = RECRUITMENT_TEST_MANAGER_EMPLOYEE_CODES[0];
const DAYS = 60;
const EXPECTED_WORK_MINUTES = 480;
const LEAVE_REASON = "Test Manager One color seed · approved CL";
const LEAVE_CONFLICT_REASON = "Test Manager One color seed · leave conflict CL";
const HOLIDAY_NAME = "TEST-MGR-01 Color Seed Holiday";
const HOLIDAY_WORKED_NAME = "TEST-MGR-01 Color Seed Holiday (worked)";

type SessionSeed = {
  checkIn: string;
  checkOut: string;
  workedMinutes: number;
};

type AttendancePayload = {
  shift: string;
  checkIn: string | null;
  checkOut: string | null;
  workedMinutes: number;
  overtimeMinutes: number;
  status: string;
  remarks: string;
  sessions: SessionSeed[];
};

type DayPlan =
  | { kind: "attendance"; payload: AttendancePayload }
  | { kind: "clear" }
  | { kind: "holiday"; name: string }
  | { kind: "leave"; leaveType: string; reason: string };

const TODAY_SESSIONS: SessionSeed[] = [
  { checkIn: "09:05", checkOut: "10:30", workedMinutes: 85 },
  { checkIn: "10:45", checkOut: "12:15", workedMinutes: 90 },
  { checkIn: "13:00", checkOut: "15:00", workedMinutes: 120 },
  { checkIn: "15:15", checkOut: "18:20", workedMinutes: 185 },
];

function startOfDayLocal(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dateAtOffset(today: Date, offset: number): Date {
  const d = startOfDayLocal(today);
  d.setDate(today.getDate() - offset);
  return d;
}

function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function presentPayload(
  workedMinutes: number,
  remarks: string,
  checkIn = "09:00",
  checkOut?: string
): AttendancePayload {
  const out =
    checkOut ??
    minutesToHhMm(9 * 60 + workedMinutes + 60); // rough end time for single session
  const overtimeMinutes = Math.max(0, workedMinutes - EXPECTED_WORK_MINUTES);
  return {
    shift: "Morning Shift",
    checkIn,
    checkOut: out,
    workedMinutes,
    overtimeMinutes,
    status: workedMinutes >= EXPECTED_WORK_MINUTES ? "Present" : "Short Hours",
    remarks,
    sessions: [{ checkIn, checkOut: out, workedMinutes }],
  };
}

function minutesToHhMm(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function findOffsetFrom(
  today: Date,
  startOffset: number,
  predicate: (date: Date) => boolean
): number {
  for (let offset = startOffset; offset < DAYS; offset += 1) {
    if (predicate(dateAtOffset(today, offset))) return offset;
  }
  throw new Error("Could not find a matching date in the 60-day window.");
}

function buildDayPlans(today: Date): {
  plans: Map<number, DayPlan>;
  showcase: Record<string, string>;
} {
  const plans = new Map<number, DayPlan>();

  const absentOffset = findOffsetFrom(today, 7, (d) => {
    const dow = d.getDay();
    return dow !== 0 && dow !== 6;
  });
  const leaveOffset = findOffsetFrom(today, absentOffset + 1, (d) => {
    const dow = d.getDay();
    return dow !== 0 && dow !== 6;
  });
  const holidayOffset = findOffsetFrom(today, leaveOffset + 1, (d) => {
    const dow = d.getDay();
    return dow !== 0 && dow !== 6;
  });
  const workedHolidayOffset = findOffsetFrom(today, holidayOffset + 1, (d) => {
    const dow = d.getDay();
    return dow !== 0 && dow !== 6;
  });
  const leaveConflictOffset = findOffsetFrom(today, workedHolidayOffset + 1, (d) => {
    const dow = d.getDay();
    return dow !== 0 && dow !== 6;
  });
  const weeklyOffOffset = findOffsetFrom(today, 12, (d) => d.getDay() === 6);
  const workedWeeklyOffOffset = findOffsetFrom(today, weeklyOffOffset + 1, (d) => d.getDay() === 6);

  const iso = (offset: number) => dateAtOffset(today, offset).toISOString().slice(0, 10);

  const todayWorked = TODAY_SESSIONS.reduce((s, x) => s + x.workedMinutes, 0);

  // Heatmap color / classifier showcase (offsets from today)
  plans.set(0, {
    kind: "attendance",
    payload: {
      shift: "Morning Shift",
      checkIn: TODAY_SESSIONS[0].checkIn,
      checkOut: TODAY_SESSIONS[TODAY_SESSIONS.length - 1].checkOut,
      workedMinutes: todayWorked,
      overtimeMinutes: Math.max(0, todayWorked - EXPECTED_WORK_MINUTES),
      status: todayWorked >= EXPECTED_WORK_MINUTES ? "Present" : "Short Hours",
      remarks: "Color seed · target · multi-session logins/logouts",
      sessions: TODAY_SESSIONS,
    },
  });
  plans.set(1, {
    kind: "attendance",
    payload: presentPayload(600, "Color seed · overtime tier (≥120%)"),
  });
  plans.set(2, {
    kind: "attendance",
    payload: presentPayload(500, "Color seed · target tier (100–119%)"),
  });
  plans.set(3, {
    kind: "attendance",
    payload: presentPayload(420, "Color seed · near_target tier (80–99%)"),
  });
  plans.set(4, {
    kind: "attendance",
    payload: presentPayload(300, "Color seed · partial tier (50–79%)"),
  });
  plans.set(5, {
    kind: "attendance",
    payload: presentPayload(180, "Color seed · very_low tier (<50%)"),
  });
  plans.set(6, {
    kind: "attendance",
    payload: {
      shift: "Morning Shift",
      checkIn: "09:12",
      checkOut: null,
      workedMinutes: 0,
      overtimeMinutes: 0,
      status: "Short Hours",
      remarks: "Color seed · insufficient data · missing checkout",
      sessions: [],
    },
  });
  plans.set(absentOffset, { kind: "clear" });
  plans.set(leaveOffset, { kind: "leave", leaveType: "CL", reason: LEAVE_REASON });
  plans.set(holidayOffset, { kind: "holiday", name: HOLIDAY_NAME });
  plans.set(workedHolidayOffset, {
    kind: "attendance",
    payload: presentPayload(520, "Color seed · worked on holiday", "09:00", "18:40"),
  });
  plans.set(leaveConflictOffset, {
    kind: "attendance",
    payload: presentPayload(
      490,
      "Color seed · leave conflict · attendance on approved leave",
      "09:03",
      "18:10"
    ),
  });
  plans.set(weeklyOffOffset, { kind: "clear" });
  plans.set(workedWeeklyOffOffset, {
    kind: "attendance",
    payload: presentPayload(480, "Color seed · worked on weekly off (Saturday)", "10:00", "19:00"),
  });

  for (let offset = 0; offset < DAYS; offset += 1) {
    if (plans.has(offset)) continue;

    const date = dateAtOffset(today, offset);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) {
      plans.set(offset, { kind: "clear" });
      continue;
    }

    const workedMinutes = 460 + (offset % 7) * 3;
    plans.set(offset, {
      kind: "attendance",
      payload: presentPayload(workedMinutes, "Routine office day · test seed filler"),
    });
  }

  return {
    plans,
    showcase: {
      today_target: iso(0),
      overtime: iso(1),
      target: iso(2),
      near_target: iso(3),
      partial: iso(4),
      very_low: iso(5),
      insufficient_data: iso(6),
      absent: iso(absentOffset),
      leave: iso(leaveOffset),
      holiday: iso(holidayOffset),
      worked_holiday: iso(workedHolidayOffset),
      leave_conflict: iso(leaveConflictOffset),
      weekly_off: iso(weeklyOffOffset),
      worked_weekly_off: iso(workedWeeklyOffOffset),
    },
  };
}

async function upsertAttendance(
  prisma: PrismaClient,
  employeeId: number,
  date: Date,
  payload: AttendancePayload
): Promise<void> {
  const record = await prisma.attendanceRecord.upsert({
    where: {
      employeeId_attendanceDate: {
        employeeId,
        attendanceDate: date,
      },
    },
    create: {
      employeeId,
      attendanceDate: date,
      shift: payload.shift,
      checkIn: payload.checkIn,
      checkOut: payload.checkOut,
      workDuration: duration(payload.workedMinutes),
      workedMinutes: payload.workedMinutes,
      overtimeMinutes: payload.overtimeMinutes,
      status: payload.status,
      remarks: payload.remarks,
    },
    update: {
      shift: payload.shift,
      checkIn: payload.checkIn,
      checkOut: payload.checkOut,
      workDuration: duration(payload.workedMinutes),
      workedMinutes: payload.workedMinutes,
      overtimeMinutes: payload.overtimeMinutes,
      status: payload.status,
      remarks: payload.remarks,
    },
  });

  await prisma.attendanceSession.deleteMany({ where: { attendanceId: record.id } });
  if (payload.sessions.length > 0) {
    await prisma.attendanceSession.createMany({
      data: payload.sessions.map((s) => ({
        attendanceId: record.id,
        checkIn: s.checkIn,
        checkOut: s.checkOut,
        workedMinutes: s.workedMinutes,
      })),
    });
  }
}

async function clearAttendance(
  prisma: PrismaClient,
  employeeId: number,
  date: Date
): Promise<void> {
  await prisma.attendanceRecord.deleteMany({
    where: { employeeId, attendanceDate: date },
  });
}

async function upsertHoliday(prisma: PrismaClient, date: Date, name: string): Promise<void> {
  await prisma.holiday.upsert({
    where: { holidayDate: date },
    create: { name, holidayDate: date },
    update: { name },
  });
}

async function upsertApprovedLeave(
  prisma: PrismaClient,
  employeeId: number,
  date: Date,
  leaveType: string,
  reason: string
): Promise<void> {
  const existing = await prisma.leaveRequest.findFirst({
    where: { employeeId, reason },
  });

  const data = {
    leaveType,
    startDate: date,
    endDate: date,
    days: 1,
    reason,
    status: LeaveRequestStatus.approved,
    workflowStatus: LeaveWorkflowStatus.approved,
    submittedAt: date,
    finalApprovedAt: date,
  };

  if (existing) {
    await prisma.leaveRequest.update({ where: { id: existing.id }, data });
  } else {
    await prisma.leaveRequest.create({ data: { employeeId, ...data } });
  }
}

async function main(): Promise<void> {
  const prisma = createPrismaClient();

  try {
    const employee = await prisma.employee.findFirst({
      where: {
        OR: [
          { employeeCode: EMP_CODE },
          { name: { equals: "Test Manager One", mode: "insensitive" } },
        ],
      },
    });

    if (!employee) {
      throw new Error(
        `Test Manager One (${EMP_CODE}) not found. Run npm run db:seed:test-managers first.`
      );
    }

    const today = startOfDayLocal();
    const { plans, showcase } = buildDayPlans(today);

    const holidayDates: { date: Date; name: string }[] = [];
    const leaveDates: { date: Date; leaveType: string; reason: string }[] = [];

    for (const [offsetStr, plan] of plans) {
      const offset = Number(offsetStr);
      const date = dateAtOffset(today, offset);

      if (plan.kind === "holiday") {
        holidayDates.push({ date, name: plan.name });
        await clearAttendance(prisma, employee.id, date);
        continue;
      }

      if (plan.kind === "leave") {
        leaveDates.push({ date, leaveType: plan.leaveType, reason: plan.reason });
        await clearAttendance(prisma, employee.id, date);
        continue;
      }

      if (plan.kind === "clear") {
        await clearAttendance(prisma, employee.id, date);
        continue;
      }

      await upsertAttendance(prisma, employee.id, date, plan.payload);
    }

    for (const { date, name } of holidayDates) {
      await upsertHoliday(prisma, date, name);
    }

    if (showcase.worked_holiday) {
      await upsertHoliday(
        prisma,
        startOfDayLocal(new Date(`${showcase.worked_holiday}T00:00:00`)),
        HOLIDAY_WORKED_NAME
      );
    }

    for (const { date, leaveType, reason } of leaveDates) {
      await upsertApprovedLeave(prisma, employee.id, date, leaveType, reason);
    }

    if (showcase.leave_conflict) {
      await upsertApprovedLeave(
        prisma,
        employee.id,
        startOfDayLocal(new Date(`${showcase.leave_conflict}T00:00:00`)),
        "CL",
        LEAVE_CONFLICT_REASON
      );
    }

    const todaySessions = await prisma.attendanceSession.findMany({
      where: {
        attendance: {
          employeeId: employee.id,
          attendanceDate: today,
        },
      },
      orderBy: [{ checkIn: "asc" }, { id: "asc" }],
    });

    console.log("[AMS] Test Manager One attendance seeded — all heatmap colors.");
    console.log(
      JSON.stringify(
        {
          employeeId: employee.id,
          employeeCode: employee.employeeCode,
          name: employee.name,
          rangeDays: DAYS,
          from: dateAtOffset(today, DAYS - 1).toISOString().slice(0, 10),
          to: today.toISOString().slice(0, 10),
          heatmapShowcase: showcase,
          today: {
            loginsLogouts: todaySessions.map((s) => ({
              checkIn: s.checkIn,
              checkOut: s.checkOut,
              workedMinutes: s.workedMinutes,
            })),
          },
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(
    "[AMS] Test Manager One attendance seed failed:",
    e instanceof Error ? e.message : e
  );
  process.exit(1);
});
