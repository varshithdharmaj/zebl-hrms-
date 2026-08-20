/**
 * One-off correction for the double-subtraction timezone bug: the bridge subtracted
 * 5.5h once (correctly), then the HRMS parser subtracted 5.5h again for naive
 * timestamps, so affected punches were stored 5.5h too EARLY. This shifts them
 * forward by +5.5h and re-derives attendance for every affected employee/date.
 *
 * Uses a standalone PrismaClient rather than importing src/lib/prisma or
 * src/lib/integrations/biometric-attendance-derivation's transitive deps — those
 * import `server-only`, which unconditionally throws under plain `tsx`/Node
 * execution. Follows the same pattern as prisma/scripts/apply-manager-role.ts.
 *
 * Usage:
 *   npx tsx scripts/fix-timezones.ts
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

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
  if (!url) throw new Error("DATABASE_URL (or DIRECT_URL) is not set.");
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: url, maxUses: 1 }),
    log: ["error", "warn"],
  });
}

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/** Same IST calendar-part extraction as biometric-attendance-derivation.ts's getISTDateParts(). */
function getISTDateParts(date: Date): { attendanceDate: Date; dateString: string } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const p of formatter.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const year = parseInt(map.year, 10);
  const month = parseInt(map.month, 10);
  const day = parseInt(map.day, 10);
  const attendanceDate = new Date(year, month - 1, day);
  attendanceDate.setHours(0, 0, 0, 0);
  const dateString = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { attendanceDate, dateString };
}

type AffectedGroup = { employeeId: number; attendanceDate: Date; dateString: string };

/**
 * Rebuild AttendanceRecord and AttendanceSession rows for one employee/date from
 * their full chronological BiometricPunch history. Mirrors
 * deriveAttendanceForEmployeeDate() in biometric-attendance-derivation.ts, which
 * cannot be imported directly here (transitively pulls in `server-only`).
 */
async function deriveAttendanceForEmployeeDate(
  prisma: PrismaClient,
  employeeId: number,
  attendanceDate: Date
): Promise<void> {
  await prisma.$transaction(async (tx: Tx) => {
    const dateParts = getISTDateParts(attendanceDate);

    const lockKey = `biometric_derivation_${employeeId}_${dateParts.dateString}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

    const dayStartUtc = new Date(
      Date.UTC(
        attendanceDate.getFullYear(),
        attendanceDate.getMonth(),
        attendanceDate.getDate(),
        0,
        0,
        0
      ) - IST_OFFSET_MS
    );
    const dayEndUtc = new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000 - 1);

    const punches = await tx.biometricPunch.findMany({
      where: { employeeId, punchedAt: { gte: dayStartUtc, lte: dayEndUtc } },
      orderBy: [{ punchedAt: "asc" }, { id: "asc" }],
    });

    const dayPunches = punches.filter(
      (p) => getISTDateParts(p.punchedAt).dateString === dateParts.dateString
    );

    if (dayPunches.length === 0) {
      const existingRecord = await tx.attendanceRecord.findUnique({
        where: { employeeId_attendanceDate: { employeeId, attendanceDate } },
      });
      if (existingRecord && existingRecord.remarks === "Biometric Device Ingestion") {
        await tx.attendanceSession.deleteMany({ where: { attendanceId: existingRecord.id } });
        await tx.attendanceRecord.delete({ where: { id: existingRecord.id } });
      }
      return;
    }

    let record = await tx.attendanceRecord.findUnique({
      where: { employeeId_attendanceDate: { employeeId, attendanceDate } },
      select: { id: true, remarks: true },
    });

    if (!record) {
      record = await tx.attendanceRecord.create({
        data: {
          employeeId,
          attendanceDate,
          checkIn: null,
          checkOut: null,
          workedMinutes: 0,
          overtimeMinutes: 0,
          status: "Absent",
          remarks: "Biometric Device Ingestion",
        },
        select: { id: true, remarks: true },
      });
    }

    await tx.attendanceSession.deleteMany({ where: { attendanceId: record.id } });

    const sessionDataToCreate: Array<{
      attendanceId: number;
      checkIn: string;
      checkOut: string | null;
      workedMinutes: number;
    }> = [];

    const toTimeString = (d: Date): string => {
      const f = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const m: Record<string, string> = {};
      for (const p of f.formatToParts(d)) if (p.type !== "literal") m[p.type] = p.value;
      const hourStr = m.hour === "24" ? "00" : (m.hour ?? "00").padStart(2, "0");
      return `${hourStr}:${(m.minute ?? "00").padStart(2, "0")}`;
    };

    const sessionDurationMinutes = (checkIn: string, checkOut: string): number => {
      const [inH, inM] = checkIn.split(":").map(Number);
      const [outH, outM] = checkOut.split(":").map(Number);
      let diff = outH * 60 + outM - (inH * 60 + inM);
      if (diff < 0) diff += 24 * 60;
      return diff;
    };

    for (let i = 0; i < dayPunches.length; i += 2) {
      const inPunch = dayPunches[i];
      const outPunch = dayPunches[i + 1];
      const checkInTime = toTimeString(inPunch.punchedAt);
      const checkOutTime = outPunch ? toTimeString(outPunch.punchedAt) : null;
      const worked = checkOutTime ? sessionDurationMinutes(checkInTime, checkOutTime) : 0;
      sessionDataToCreate.push({
        attendanceId: record.id,
        checkIn: checkInTime,
        checkOut: checkOutTime,
        workedMinutes: worked,
      });
    }

    if (sessionDataToCreate.length > 0) {
      await tx.attendanceSession.createMany({ data: sessionDataToCreate });
    }

    const sessions = await tx.attendanceSession.findMany({
      where: { attendanceId: record.id },
      orderBy: [{ checkIn: "asc" }, { id: "asc" }],
    });

    const completed = sessions.filter((s) => s.checkOut !== null);
    const open = sessions.find((s) => s.checkOut === null);
    const workedMinutes = completed.reduce(
      (sum, s) => sum + sessionDurationMinutes(s.checkIn, s.checkOut as string),
      0
    );
    const firstCheckIn = sessions[0]?.checkIn ?? null;
    const lastCompletedOut = [...completed].reverse().find((s) => s.checkOut)?.checkOut ?? null;
    const checkOut = open ? null : lastCompletedOut;
    const checkIn = firstCheckIn;

    const h = Math.floor(workedMinutes / 60);
    const m = workedMinutes % 60;
    const workDuration = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const status = checkIn ? (workedMinutes >= 240 ? "Present" : "Half Day") : "Absent";

    await tx.attendanceRecord.update({
      where: { id: record.id },
      data: {
        checkIn,
        checkOut,
        workedMinutes,
        workDuration,
        status,
        ...(record.remarks === null || record.remarks === "Live check-in"
          ? { remarks: "Biometric Device Ingestion" }
          : {}),
      },
    });
  }, { maxWait: 10000, timeout: 30000 });
}

async function deriveAttendanceForAffectedGroups(
  prisma: PrismaClient,
  groups: AffectedGroup[]
): Promise<void> {
  const uniqueGroupsMap = new Map<string, AffectedGroup>();
  for (const g of groups) {
    uniqueGroupsMap.set(`${g.employeeId}_${g.dateString}`, g);
  }
  for (const group of uniqueGroupsMap.values()) {
    await deriveAttendanceForEmployeeDate(prisma, group.employeeId, group.attendanceDate);
  }
}

async function main() {
  console.log("Starting timezone correction for today's biometric punches...");

  // Correct UTC window for "2026-08-18" IST is 2026-08-17T18:30:00Z .. 2026-08-18T18:30:00Z.
  // Corrupted (double-subtracted) punches are stored 5.5h EARLIER than that, so the
  // window to select the affected rows is shifted back by 5.5h as well.
  const corruptedStartUtc = new Date("2026-08-17T13:00:00.000Z");
  const corruptedEndUtc = new Date("2026-08-18T13:00:00.000Z");

  const prisma = createPrismaClient();
  try {
    const punchesToAdjust = await prisma.biometricPunch.findMany({
      where: { punchedAt: { gte: corruptedStartUtc, lte: corruptedEndUtc } },
    });

    console.log(`Found ${punchesToAdjust.length} punches to adjust.`);
    console.log("Sample of records to be adjusted (first 5):");
    for (const p of punchesToAdjust.slice(0, 5)) {
      const corrected = new Date(p.punchedAt.getTime() + IST_OFFSET_MS);
      console.log(
        `  id=${p.id} employeeId=${p.employeeId} punchedAt=${p.punchedAt.toISOString()} -> ${corrected.toISOString()}`
      );
    }

    const affectedGroups: AffectedGroup[] = [];

    for (const punch of punchesToAdjust) {
      const newDate = new Date(punch.punchedAt.getTime() + IST_OFFSET_MS);

      await prisma.biometricPunch.update({
        where: { id: punch.id },
        data: { punchedAt: newDate },
      });

      if (punch.employeeId) {
        const parts = getISTDateParts(newDate);
        affectedGroups.push({
          employeeId: punch.employeeId,
          attendanceDate: parts.attendanceDate,
          dateString: parts.dateString,
        });
      }
    }

    console.log(
      `Re-deriving attendance for ${new Set(affectedGroups.map((g) => `${g.employeeId}_${g.dateString}`)).size} employee-date combinations...`
    );

    await deriveAttendanceForAffectedGroups(prisma, affectedGroups);

    console.log("Done!");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[AMS] fix-timezones failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
