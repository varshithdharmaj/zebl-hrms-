/**
 * Measures payroll recompute wall time (writes summaries).
 * Run (PowerShell):
 *   $env:PERF_UPSERT_CONCURRENCY='1'; npx tsx scripts/perf-payroll-recompute.ts
 *   $env:PERF_UPSERT_CONCURRENCY='20'; npx tsx scripts/perf-payroll-recompute.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { PrismaClient } from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { getDefaultPayrollPeriod } from "../src/lib/payroll/payroll-period.ts";
import { computeEmployeePeriodMetrics } from "../src/lib/payroll/payroll-calculations.ts";
import type { PayrollSettingsSnapshot } from "../src/lib/payroll/payroll-types.ts";

function loadEnvFile(filename: string): void {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
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

const UPSERT_CONCURRENCY = Math.max(1, Number(process.env.PERF_UPSERT_CONCURRENCY ?? "1"));

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL missing");

  const adapter = new PrismaPg({ connectionString: url, maxUses: 1 });
  const prisma = new PrismaClient({ adapter, log: ["error"] });

  try {
    const row =
      (await prisma.payrollSettings.findFirst()) ??
      (await prisma.payrollSettings.create({
        data: { id: "default" },
      }));

    let shiftRules: PayrollSettingsSnapshot["shiftRules"] = {};
    try {
      shiftRules = JSON.parse(row.shiftRulesJson || "{}") as PayrollSettingsSnapshot["shiftRules"];
    } catch {
      shiftRules = {};
    }

    const settings: PayrollSettingsSnapshot = {
      payrollStartDay: row.payrollStartDay,
      requiredWorkMinutes: row.requiredWorkMinutes,
      breakMinutes: row.breakMinutes,
      requiredOfficeMinutes: row.requiredOfficeMinutes,
      otThresholdMinutes: row.otThresholdMinutes,
      halfDayThresholdMinutes: row.halfDayThresholdMinutes,
      graceMinutes: row.graceMinutes,
      shiftRules,
    };

    const period = getDefaultPayrollPeriod(settings.payrollStartDay);

    const tLoad = performance.now();
    const employees = await prisma.employee.findMany({
      where: { isActive: true },
      select: { id: true, shift: true },
    });
    const attendanceByEmployee = await prisma.attendanceRecord.findMany({
      where: {
        attendanceDate: { gte: period.start, lte: period.end },
        employeeId: { in: employees.map((e) => e.id) },
      },
      orderBy: { attendanceDate: "asc" },
    });
    const leaveByEmployee = await prisma.leaveRequest.findMany({
      where: {
        employeeId: { in: employees.map((e) => e.id) },
        workflowStatus: "approved",
        startDate: { lte: period.end },
        endDate: { gte: period.start },
      },
      select: { employeeId: true, days: true },
    });
    const loadMs = Math.round(performance.now() - tLoad);

    const leaveDaysMap = new Map<number, number>();
    for (const leave of leaveByEmployee) {
      leaveDaysMap.set(leave.employeeId, (leaveDaysMap.get(leave.employeeId) ?? 0) + leave.days);
    }
    const recordsMap = new Map<number, typeof attendanceByEmployee>();
    for (const rowAtt of attendanceByEmployee) {
      const list = recordsMap.get(rowAtt.employeeId) ?? [];
      list.push(rowAtt);
      recordsMap.set(rowAtt.employeeId, list);
    }

    const tUpsert = performance.now();
    let upserted = 0;
    for (let i = 0; i < employees.length; i += UPSERT_CONCURRENCY) {
      const batch = employees.slice(i, i + UPSERT_CONCURRENCY);
      await Promise.all(
        batch.map(async (employee) => {
          const records = recordsMap.get(employee.id) ?? [];
          const metrics = computeEmployeePeriodMetrics(
            records,
            settings,
            employee.shift,
            leaveDaysMap.get(employee.id) ?? 0
          );
          await prisma.payrollAttendanceSummary.upsert({
            where: {
              employeeId_payrollPeriodStart_payrollPeriodEnd: {
                employeeId: employee.id,
                payrollPeriodStart: period.start,
                payrollPeriodEnd: period.end,
              },
            },
            create: {
              employeeId: employee.id,
              payrollPeriodStart: period.start,
              payrollPeriodEnd: period.end,
              ...metrics,
            },
            update: {
              workingDays: metrics.workingDays,
              requiredMinutes: metrics.requiredMinutes,
              actualMinutes: metrics.actualMinutes,
              shortfallMinutes: metrics.shortfallMinutes,
              otMinutes: metrics.otMinutes,
              leaveDays: metrics.leaveDays,
              absentDays: metrics.absentDays,
              lateCount: metrics.lateCount,
              recommendedDeduction: metrics.recommendedDeduction,
              computedAt: new Date(),
            },
          });
        })
      );
      upserted += batch.length;
    }
    const upsertMs = Math.round(performance.now() - tUpsert);

    console.log(
      JSON.stringify(
        {
          periodKey: period.key,
          employees: employees.length,
          attendanceRows: attendanceByEmployee.length,
          upserted,
          concurrency: UPSERT_CONCURRENCY,
          loadMs,
          upsertMs,
          totalMs: loadMs + upsertMs,
          projectedPageDoubleRecomputeMs: (loadMs + upsertMs) * 2,
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
