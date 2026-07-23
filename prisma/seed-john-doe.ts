import {
  type PrismaClient,
  type Prisma,
  AnalyticsScope,
  AnomalySeverity,
  ApprovalStepStatus,
  ApproverRole,
  CalendarSyncStatus,
  LeaveRequestStatus,
  LeaveWorkflowStatus,
  MetricPeriod,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationType,
  PayrollHrDecision,
} from "@/generated/prisma/client";
import { createHash } from "node:crypto";

const QA_MARKER = "qa-john-doe-2026-06";
const JOHN_EMPLOYEE_CODE = "EMP-JDOE";
const PERIOD_START = new Date("2026-06-01T00:00:00.000Z");
const PERIOD_END = new Date("2026-06-30T23:59:59.999Z");

type AttendanceSeed = {
  day: number;
  shift: string;
  checkIn: string | null;
  checkOut: string | null;
  workedMinutes: number;
  overtimeMinutes: number;
  status: string;
  remarks: string;
};

type LeaveSeed = {
  key: string;
  leaveType: string;
  startDay: number;
  endDay: number;
  days: number;
  reason: string;
  status: LeaveRequestStatus;
  workflowStatus: LeaveWorkflowStatus;
  stepStatus: ApprovalStepStatus;
  rejectionReason?: string;
  cancelledAt?: Date;
  escalated?: boolean;
};

function utcDay(day: number, hour = 0): Date {
  return new Date(Date.UTC(2026, 5, day, hour, 0, 0, 0));
}

function duration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function tokenHash(key: string): string {
  return createHash("sha256").update(`${QA_MARKER}:${key}`).digest("hex");
}

function attendanceSeeds(): AttendanceSeed[] {
  return [
    { day: 1, shift: "Morning Shift", checkIn: "09:01", checkOut: "18:08", workedMinutes: 487, overtimeMinutes: 7, status: "Present", remarks: "Office · biometric punch" },
    { day: 2, shift: "Morning Shift", checkIn: "09:32", checkOut: "18:12", workedMinutes: 460, overtimeMinutes: 0, status: "Short Hours", remarks: "Late arrival · approved regularization" },
    { day: 3, shift: "Morning Shift", checkIn: "08:58", checkOut: "17:25", workedMinutes: 447, overtimeMinutes: 0, status: "Short Hours", remarks: "Early checkout · client appointment" },
    { day: 4, shift: "Morning Shift", checkIn: "09:03", checkOut: "18:20", workedMinutes: 497, overtimeMinutes: 17, status: "Present", remarks: "Work From Home · VPN verified" },
    { day: 5, shift: "Morning Shift", checkIn: "09:07", checkOut: "19:12", workedMinutes: 545, overtimeMinutes: 65, status: "Present", remarks: "Office · overtime approved" },
    { day: 6, shift: "Weekend", checkIn: "10:02", checkOut: "15:18", workedMinutes: 316, overtimeMinutes: 316, status: "Present", remarks: "Weekend work · production deployment" },
    { day: 7, shift: "Weekly Off", checkIn: null, checkOut: null, workedMinutes: 0, overtimeMinutes: 0, status: "Weekly Off", remarks: "Sunday weekly off" },
    { day: 8, shift: "Morning Shift", checkIn: null, checkOut: null, workedMinutes: 0, overtimeMinutes: 0, status: "Absent", remarks: "Sick leave requested after attendance was marked absent" },
    { day: 9, shift: "Morning Shift", checkIn: "09:00", checkOut: null, workedMinutes: 0, overtimeMinutes: 0, status: "Short Hours", remarks: "Missing checkout · pending regularization · biometric failure" },
    { day: 10, shift: "Morning Shift", checkIn: null, checkOut: "18:04", workedMinutes: 0, overtimeMinutes: 0, status: "Short Hours", remarks: "Missing check-in · rejected regularization" },
    { day: 11, shift: "Morning Shift", checkIn: "13:31", checkOut: "18:05", workedMinutes: 274, overtimeMinutes: 0, status: "Short Hours", remarks: "Half-day casual leave + half-day attendance" },
    { day: 12, shift: "Morning Shift", checkIn: "09:05", checkOut: "18:06", workedMinutes: 481, overtimeMinutes: 1, status: "Present", remarks: "Remote · manual punch approved by HR" },
    { day: 13, shift: "Weekend", checkIn: "10:00", checkOut: "14:20", workedMinutes: 260, overtimeMinutes: 260, status: "Present", remarks: "Saturday overtime · manual punch" },
    { day: 14, shift: "Weekly Off", checkIn: null, checkOut: null, workedMinutes: 0, overtimeMinutes: 0, status: "Weekly Off", remarks: "Sunday weekly off" },
    { day: 15, shift: "Morning Shift", checkIn: "09:46", checkOut: "18:34", workedMinutes: 468, overtimeMinutes: 0, status: "Short Hours", remarks: "Late arrival · pending manager review" },
    { day: 16, shift: "Morning Shift", checkIn: "09:02", checkOut: "18:02", workedMinutes: 480, overtimeMinutes: 0, status: "Present", remarks: "Office · biometric punch" },
    { day: 17, shift: "Morning Shift", checkIn: "09:04", checkOut: "18:37", workedMinutes: 513, overtimeMinutes: 33, status: "Present", remarks: "Work From Home · extended support" },
    { day: 18, shift: "Morning Shift", checkIn: "09:01", checkOut: "18:10", workedMinutes: 489, overtimeMinutes: 9, status: "Present", remarks: "Office · corrected check-in approved by HR" },
    { day: 19, shift: "Morning Shift", checkIn: "09:06", checkOut: "13:08", workedMinutes: 242, overtimeMinutes: 0, status: "Short Hours", remarks: "Half day · family appointment" },
    { day: 20, shift: "Weekend", checkIn: null, checkOut: null, workedMinutes: 0, overtimeMinutes: 0, status: "Weekly Off", remarks: "Saturday weekly off" },
    { day: 21, shift: "Holiday", checkIn: "09:55", checkOut: "16:24", workedMinutes: 389, overtimeMinutes: 389, status: "Present", remarks: "Holiday work · critical maintenance · overtime" },
    { day: 22, shift: "Night Shift", checkIn: "21:58", checkOut: "06:14", workedMinutes: 496, overtimeMinutes: 16, status: "Present", remarks: "Night shift · cross-midnight shift" },
    { day: 23, shift: "Night Shift", checkIn: "22:05", checkOut: "14:02", workedMinutes: 957, overtimeMinutes: 477, status: "Present", remarks: "Double shift · cross-midnight incident support" },
    { day: 24, shift: "Morning Shift", checkIn: "09:00", checkOut: "18:03", workedMinutes: 483, overtimeMinutes: 3, status: "Present", remarks: "Office · biometric punch" },
    { day: 25, shift: "Morning Shift", checkIn: "09:10", checkOut: "18:00", workedMinutes: 470, overtimeMinutes: 0, status: "Short Hours", remarks: "Late arrival · warning issued" },
    { day: 26, shift: "Morning Shift", checkIn: "09:02", checkOut: "18:45", workedMinutes: 523, overtimeMinutes: 43, status: "Present", remarks: "Remote · month-end payroll support" },
    { day: 27, shift: "Weekend", checkIn: "10:15", checkOut: "17:00", workedMinutes: 405, overtimeMinutes: 405, status: "Present", remarks: "Weekend overtime · approved exception" },
    { day: 28, shift: "Weekly Off", checkIn: null, checkOut: null, workedMinutes: 0, overtimeMinutes: 0, status: "Weekly Off", remarks: "Sunday weekly off" },
    { day: 29, shift: "Morning Shift", checkIn: "09:03", checkOut: "18:08", workedMinutes: 485, overtimeMinutes: 5, status: "Present", remarks: "Office · biometric punch" },
    { day: 30, shift: "Morning Shift", checkIn: "09:04", checkOut: "18:25", workedMinutes: 501, overtimeMinutes: 21, status: "Present", remarks: "Office · month-end close" },
  ];
}

function leaveSeeds(holidayDay: number | null): LeaveSeed[] {
  const holidayOverlapDay = holidayDay ?? 21;
  return [
    {
      key: "cl-approved",
      leaveType: "CL",
      startDay: 11,
      endDay: 11,
      days: 0.5,
      reason: "Half-day casual leave for personal appointment",
      status: LeaveRequestStatus.approved,
      workflowStatus: LeaveWorkflowStatus.approved,
      stepStatus: ApprovalStepStatus.approved,
    },
    {
      key: "sl-approved-after-attendance",
      leaveType: "SL",
      startDay: 8,
      endDay: 8,
      days: 1,
      reason: "Sick leave requested after attendance was marked absent",
      status: LeaveRequestStatus.approved,
      workflowStatus: LeaveWorkflowStatus.approved,
      stepStatus: ApprovalStepStatus.approved,
    },
    {
      key: "el-weekend",
      leaveType: "EL",
      startDay: 12,
      endDay: 15,
      days: 2,
      reason: "Earned leave spanning a weekend",
      status: LeaveRequestStatus.approved,
      workflowStatus: LeaveWorkflowStatus.approved,
      stepStatus: ApprovalStepStatus.approved,
    },
    {
      key: "lop-pending",
      leaveType: "LOP",
      startDay: 29,
      endDay: 30,
      days: 2,
      reason: "Loss of pay request pending during payroll period",
      status: LeaveRequestStatus.pending,
      workflowStatus: LeaveWorkflowStatus.pending_approval,
      stepStatus: ApprovalStepStatus.pending,
      escalated: true,
    },
    {
      key: "sl-rejected",
      leaveType: "SL",
      startDay: 10,
      endDay: 10,
      days: 1,
      reason: "Sick leave request without supporting document",
      status: LeaveRequestStatus.rejected,
      workflowStatus: LeaveWorkflowStatus.rejected,
      stepStatus: ApprovalStepStatus.rejected,
      rejectionReason: "Medical document required for retrospective request",
    },
    {
      key: "cl-cancelled",
      leaveType: "CL",
      startDay: 18,
      endDay: 18,
      days: 1,
      reason: "Casual leave cancelled after plans changed",
      status: LeaveRequestStatus.cancelled,
      workflowStatus: LeaveWorkflowStatus.cancelled,
      stepStatus: ApprovalStepStatus.skipped,
      cancelledAt: utcDay(17, 12),
    },
    {
      key: "el-holiday-overlap",
      leaveType: "EL",
      startDay: Math.max(1, holidayOverlapDay - 1),
      endDay: Math.min(30, holidayOverlapDay + 1),
      days: 2,
      reason: holidayDay
        ? "Earned leave overlapping an existing holiday"
        : "Earned leave adjacent to planned holiday work",
      status: LeaveRequestStatus.pending,
      workflowStatus: LeaveWorkflowStatus.pending_approval,
      stepStatus: ApprovalStepStatus.pending,
    },
  ];
}

async function createLeaveScenario(
  tx: Prisma.TransactionClient,
  employeeId: number,
  hrUserId: string,
  seed: LeaveSeed
): Promise<number> {
  const createdAt = utcDay(Math.max(1, seed.startDay - 3), 10);
  const leave = await tx.leaveRequest.create({
    data: {
      employeeId,
      leaveType: seed.leaveType,
      startDate: utcDay(seed.startDay),
      endDate: utcDay(seed.endDay),
      days: seed.days,
      reason: `[${QA_MARKER}:${seed.key}] ${seed.reason}`,
      status: seed.status,
      workflowStatus: seed.workflowStatus,
      submittedAt: createdAt,
      rejectionReason: seed.rejectionReason,
      cancelledAt: seed.cancelledAt,
      finalApprovedAt:
        seed.workflowStatus === LeaveWorkflowStatus.approved ? utcDay(seed.startDay - 1, 15) : null,
      reviewedBy:
        seed.stepStatus === ApprovalStepStatus.approved ||
        seed.stepStatus === ApprovalStepStatus.rejected
          ? hrUserId
          : null,
      reviewedAt:
        seed.stepStatus === ApprovalStepStatus.approved ||
        seed.stepStatus === ApprovalStepStatus.rejected
          ? utcDay(Math.max(1, seed.startDay - 1), 15)
          : null,
      calendarSyncStatus:
        seed.workflowStatus === LeaveWorkflowStatus.approved
          ? CalendarSyncStatus.synced
          : CalendarSyncStatus.pending,
      calendarLastSyncedAt:
        seed.workflowStatus === LeaveWorkflowStatus.approved ? utcDay(seed.startDay - 1, 16) : null,
      createdAt,
    },
  });

  const step = await tx.leaveApprovalStep.create({
    data: {
      leaveRequestId: leave.id,
      stepOrder: 1,
      approverRole: ApproverRole.hr_admin,
      status: seed.stepStatus,
      actedAt:
        seed.stepStatus === ApprovalStepStatus.pending ? null : utcDay(Math.max(1, seed.startDay - 1), 15),
      actedByUserId:
        seed.stepStatus === ApprovalStepStatus.pending ? null : hrUserId,
      comment:
        seed.stepStatus === ApprovalStepStatus.approved
          ? "Approved for QA workflow coverage"
          : seed.stepStatus === ApprovalStepStatus.rejected
            ? seed.rejectionReason
            : seed.stepStatus === ApprovalStepStatus.skipped
              ? "Request cancelled before approval"
              : "Awaiting HR review",
      createdAt,
    },
  });

  if (seed.stepStatus === ApprovalStepStatus.pending) {
    await tx.leaveRequest.update({
      where: { id: leave.id },
      data: { currentStepId: step.id },
    });

    await tx.approvalToken.createMany({
      data: [
        {
          leaveRequestId: leave.id,
          approvalStepId: step.id,
          approverUserId: hrUserId,
          action: "approve",
          tokenHash: tokenHash(`${seed.key}:approve`),
          expiresAt: utcDay(Math.min(30, seed.startDay + 3), 18),
          createdBy: QA_MARKER,
          metadata: JSON.stringify({ qaSeed: QA_MARKER, scenario: seed.key }),
          createdAt,
        },
        {
          leaveRequestId: leave.id,
          approvalStepId: step.id,
          approverUserId: hrUserId,
          action: "reject",
          tokenHash: tokenHash(`${seed.key}:reject`),
          expiresAt: utcDay(Math.min(30, seed.startDay + 3), 18),
          createdBy: QA_MARKER,
          metadata: JSON.stringify({ qaSeed: QA_MARKER, scenario: seed.key }),
          createdAt,
        },
      ],
    });
  }

  if (seed.escalated) {
    await tx.workflowEscalation.create({
      data: {
        leaveRequestId: leave.id,
        approvalStepId: step.id,
        escalationType: "approval_sla_breached",
        metadata: JSON.stringify({ qaSeed: QA_MARKER, state: "escalated" }),
        sentAt: utcDay(Math.max(1, seed.startDay - 1), 9),
      },
    });
  }

  if (seed.status === LeaveRequestStatus.approved && ["EL", "CL", "SL"].includes(seed.leaveType)) {
    await tx.leaveTransaction.create({
      data: {
        employeeId,
        leaveType: seed.leaveType,
        transactionType: "deduction",
        amount: -seed.days,
        reason: `[${QA_MARKER}:${seed.key}] Approved leave deduction`,
        createdBy: hrUserId,
        leaveRequestId: leave.id,
        createdAt: utcDay(seed.startDay, 16),
      },
    });
  }

  return leave.id;
}

export async function seedJohnDoeMonth(prisma: PrismaClient): Promise<void> {
  const employee = await prisma.employee.findUnique({
    where: { employeeCode: JOHN_EMPLOYEE_CODE },
    select: { id: true, employeeCode: true, name: true, email: true },
  });

  if (!employee || employee.name.toLowerCase() !== "john doe") {
    throw new Error(
      `John Doe (${JOHN_EMPLOYEE_CODE}) does not exist. The QA month seed was not run and no replacement employee was created.`
    );
  }

  const johnUser = await prisma.user.findFirst({
    where: { employeeId: employee.id },
    select: { id: true, email: true },
  });
  if (!johnUser) {
    throw new Error("John Doe exists but has no linked User record. QA month seed aborted.");
  }

  const hrUser = await prisma.user.findFirst({
    where: { role: { in: ["hr", "super_admin"] }, isActive: true },
    orderBy: { role: "asc" },
    select: { id: true, email: true },
  });
  if (!hrUser) {
    throw new Error("No active HR or Super Admin user exists. QA month seed aborted.");
  }

  const existingHoliday = await prisma.holiday.findFirst({
    where: { holidayDate: { gte: PERIOD_START, lte: PERIOD_END } },
    orderBy: { holidayDate: "asc" },
    select: { holidayDate: true, name: true },
  });
  const holidayDay = existingHoliday?.holidayDate.getUTCDate() ?? null;

  await prisma.$transaction(
    async (tx) => {
      await tx.employee.update({
        where: { id: employee.id },
        data: {
          department: "Engineering",
          designation: "Senior Software Engineer",
          shift: "Morning Shift",
          phone: "+91 98765 43210",
        },
      });

      await tx.attendanceSettings.upsert({
        where: { id: "default" },
        create: { id: "default" },
        update: {},
      });
      await tx.payrollSettings.upsert({
        where: { id: "default" },
        create: {
          id: "default",
          shiftRulesJson: JSON.stringify({
            "Morning Shift": {
              requiredWorkMinutes: 480,
              requiredOfficeMinutes: 540,
              graceMinutes: 15,
              otThresholdMinutes: 0,
            },
            "Night Shift": {
              requiredWorkMinutes: 480,
              requiredOfficeMinutes: 540,
              graceMinutes: 20,
              otThresholdMinutes: 0,
            },
          }),
        },
        update: {},
      });

      const existingUpload = await tx.attendanceUpload.findFirst({
        where: { fileName: `${QA_MARKER}.xlsx` },
        select: { id: true },
      });
      const upload =
        existingUpload ??
        (await tx.attendanceUpload.create({
          data: {
            fileName: `${QA_MARKER}.xlsx`,
            uploadedBy: hrUser.email,
            recordCount: 30,
            uploadedAt: utcDay(30, 18),
          },
          select: { id: true },
        }));

      for (const row of attendanceSeeds()) {
        const data = {
          uploadId: upload.id,
          shift: row.shift,
          checkIn: row.checkIn,
          checkOut: row.checkOut,
          workDuration: duration(row.workedMinutes),
          workedMinutes: row.workedMinutes,
          overtimeMinutes: row.overtimeMinutes,
          status: row.status,
          remarks: `[${QA_MARKER}] ${row.remarks}`,
        };
        await tx.attendanceRecord.upsert({
          where: {
            employeeId_attendanceDate: {
              employeeId: employee.id,
              attendanceDate: utcDay(row.day),
            },
          },
          create: {
            employeeId: employee.id,
            attendanceDate: utcDay(row.day),
            createdAt: utcDay(row.day, 19),
            ...data,
          },
          update: data,
        });
      }

      const oldLeaveIds = (
        await tx.leaveRequest.findMany({
          where: { employeeId: employee.id, reason: { startsWith: `[${QA_MARKER}:` } },
          select: { id: true },
        })
      ).map((row) => row.id);

      if (oldLeaveIds.length > 0) {
        await tx.leaveTransaction.deleteMany({ where: { leaveRequestId: { in: oldLeaveIds } } });
        await tx.leaveRequest.deleteMany({ where: { id: { in: oldLeaveIds } } });
      }

      const createdLeaveIds: number[] = [];
      for (const leave of leaveSeeds(holidayDay)) {
        createdLeaveIds.push(
          await createLeaveScenario(tx, employee.id, hrUser.id, leave)
        );
      }

      await tx.employeeLeaveBalance.upsert({
        where: { employeeId: employee.id },
        create: {
          employeeId: employee.id,
          elBalance: 8,
          clBalance: 5.5,
          slBalance: 7,
        },
        update: {
          elBalance: 8,
          clBalance: 5.5,
          slBalance: 7,
        },
      });

      await tx.leaveTransaction.deleteMany({
        where: {
          employeeId: employee.id,
          reason: { startsWith: `[${QA_MARKER}:opening]` },
        },
      });
      await tx.leaveTransaction.createMany({
        data: [
          {
            employeeId: employee.id,
            leaveType: "EL",
            transactionType: "accrual",
            amount: 0.5,
            reason: `[${QA_MARKER}:opening] Monthly earned leave accrual`,
            createdBy: hrUser.id,
            createdAt: utcDay(1, 8),
          },
          {
            employeeId: employee.id,
            leaveType: "CL",
            transactionType: "manual_adjustment",
            amount: 1,
            reason: `[${QA_MARKER}:opening] HR balance correction`,
            createdBy: hrUser.id,
            createdAt: utcDay(2, 11),
          },
        ],
      });

      const attendance = attendanceSeeds();
      const workingRecords = attendance.filter((row) => row.status !== "Weekly Off");
      const actualMinutes = workingRecords.reduce((sum, row) => sum + row.workedMinutes, 0);
      const otMinutes = attendance.reduce((sum, row) => sum + row.overtimeMinutes, 0);
      const absentDays = attendance.filter((row) => row.status === "Absent").length;
      const lateCount = attendance.filter((row) =>
        row.remarks.toLowerCase().includes("late")
      ).length;
      const requiredMinutes = workingRecords.length * 540;
      const shortfallMinutes = Math.max(0, requiredMinutes - actualMinutes);

      await tx.payrollAttendanceSummary.upsert({
        where: {
          employeeId_payrollPeriodStart_payrollPeriodEnd: {
            employeeId: employee.id,
            payrollPeriodStart: PERIOD_START,
            payrollPeriodEnd: PERIOD_END,
          },
        },
        create: {
          employeeId: employee.id,
          payrollPeriodStart: PERIOD_START,
          payrollPeriodEnd: PERIOD_END,
          workingDays: workingRecords.length,
          requiredMinutes,
          actualMinutes,
          shortfallMinutes,
          otMinutes,
          leaveDays: 3.5,
          absentDays,
          lateCount,
          recommendedDeduction: "₹2,750 attendance deduction",
          hrDecision: PayrollHrDecision.salary_deduction,
          remarks:
            "QA payroll: gross ₹92,000 · bonus ₹5,000 · OT ₹8,400 · tax ₹9,200 · attendance deduction ₹2,750 · net ₹93,450",
          computedAt: utcDay(30, 20),
        },
        update: {
          workingDays: workingRecords.length,
          requiredMinutes,
          actualMinutes,
          shortfallMinutes,
          otMinutes,
          leaveDays: 3.5,
          absentDays,
          lateCount,
          recommendedDeduction: "₹2,750 attendance deduction",
          hrDecision: PayrollHrDecision.salary_deduction,
          remarks:
            "QA payroll: gross ₹92,000 · bonus ₹5,000 · OT ₹8,400 · tax ₹9,200 · attendance deduction ₹2,750 · net ₹93,450",
          computedAt: utcDay(30, 20),
        },
      });

      await tx.notification.deleteMany({
        where: { correlationId: { startsWith: QA_MARKER } },
      });
      await tx.notification.createMany({
        data: [
          {
            type: NotificationType.leave_submitted,
            channel: NotificationChannel.email,
            recipient: hrUser.email,
            subject: "John Doe submitted a leave request",
            payload: JSON.stringify({ qaSeed: QA_MARKER, leaveRequestId: createdLeaveIds[3] }),
            status: NotificationDeliveryStatus.sent,
            correlationId: `${QA_MARKER}:leave-submitted`,
            scheduledAt: utcDay(26, 10),
            sentAt: utcDay(26, 10),
            createdAt: utcDay(26, 10),
          },
          {
            type: NotificationType.leave_approved,
            channel: NotificationChannel.email,
            recipient: johnUser.email,
            subject: "Your sick leave was approved",
            payload: JSON.stringify({ qaSeed: QA_MARKER, leaveRequestId: createdLeaveIds[1] }),
            status: NotificationDeliveryStatus.sent,
            correlationId: `${QA_MARKER}:leave-approved`,
            scheduledAt: utcDay(9, 15),
            sentAt: utcDay(9, 15),
            createdAt: utcDay(9, 15),
          },
          {
            type: NotificationType.leave_rejected,
            channel: NotificationChannel.teams,
            recipient: johnUser.email,
            subject: "Your retrospective sick leave needs documentation",
            payload: JSON.stringify({ qaSeed: QA_MARKER, leaveRequestId: createdLeaveIds[4] }),
            status: NotificationDeliveryStatus.sent,
            correlationId: `${QA_MARKER}:leave-rejected`,
            scheduledAt: utcDay(11, 15),
            sentAt: utcDay(11, 15),
            createdAt: utcDay(11, 15),
          },
          {
            type: NotificationType.leave_cancelled,
            channel: NotificationChannel.email,
            recipient: hrUser.email,
            subject: "John Doe cancelled a leave request",
            payload: JSON.stringify({ qaSeed: QA_MARKER, leaveRequestId: createdLeaveIds[5] }),
            status: NotificationDeliveryStatus.sent,
            correlationId: `${QA_MARKER}:leave-cancelled`,
            scheduledAt: utcDay(17, 12),
            sentAt: utcDay(17, 12),
            createdAt: utcDay(17, 12),
          },
          {
            type: NotificationType.escalation_reminder,
            channel: NotificationChannel.teams,
            recipient: hrUser.email,
            subject: "Manager approval overdue for John Doe",
            payload: JSON.stringify({ qaSeed: QA_MARKER, leaveRequestId: createdLeaveIds[3] }),
            status: NotificationDeliveryStatus.pending,
            correlationId: `${QA_MARKER}:escalation`,
            scheduledAt: utcDay(29, 9),
            createdAt: utcDay(29, 9),
          },
          {
            type: NotificationType.approval_required,
            channel: NotificationChannel.email,
            recipient: hrUser.email,
            subject: "Custom date leave request requires approval",
            payload: JSON.stringify({ qaSeed: QA_MARKER, leaveRequestId: createdLeaveIds[6] }),
            status: NotificationDeliveryStatus.pending,
            correlationId: `${QA_MARKER}:approval-required`,
            scheduledAt: utcDay(18, 10),
            createdAt: utcDay(18, 10),
          },
        ],
      });

      await tx.auditLog.deleteMany({
        where: { entityId: { startsWith: QA_MARKER } },
      });
      await tx.auditLog.createMany({
        data: [
          {
            entityType: "auth",
            entityId: `${QA_MARKER}:login-failed`,
            action: "auth.login.failure",
            actorUserId: johnUser.id,
            actorEmail: johnUser.email,
            metadata: JSON.stringify({ device: "Desktop", browser: "Chrome", ip: "192.0.2.41", reason: "invalid_password" }),
            createdAt: utcDay(1, 8),
          },
          {
            entityType: "auth",
            entityId: `${QA_MARKER}:login-success`,
            action: "auth.login.success",
            actorUserId: johnUser.id,
            actorEmail: johnUser.email,
            metadata: JSON.stringify({ device: "Desktop", browser: "Chrome", ip: "192.0.2.41" }),
            createdAt: utcDay(1, 9),
          },
          {
            entityType: "auth",
            entityId: `${QA_MARKER}:mobile-login`,
            action: "auth.login.success",
            actorUserId: johnUser.id,
            actorEmail: johnUser.email,
            metadata: JSON.stringify({ device: "Mobile", browser: "Safari", ip: "198.51.100.18" }),
            createdAt: utcDay(12, 8),
          },
          {
            entityType: "auth",
            entityId: `${QA_MARKER}:logout`,
            action: "auth.logout",
            actorUserId: johnUser.id,
            actorEmail: johnUser.email,
            metadata: JSON.stringify({ device: "Mobile", browser: "Safari" }),
            createdAt: utcDay(12, 19),
          },
          {
            entityType: "auth",
            entityId: `${QA_MARKER}:timeout`,
            action: "auth.session.invalidated",
            actorUserId: johnUser.id,
            actorEmail: johnUser.email,
            metadata: JSON.stringify({ reason: "session_timeout", device: "Desktop", browser: "Edge" }),
            createdAt: utcDay(20, 23),
          },
          {
            entityType: "attendance",
            entityId: `${QA_MARKER}:missing-checkout`,
            action: "attendance.regularization.submitted",
            actorUserId: johnUser.id,
            actorEmail: johnUser.email,
            metadata: JSON.stringify({ date: "2026-06-09", issue: "missing_checkout", state: "pending" }),
            createdAt: utcDay(10, 10),
          },
          {
            entityType: "attendance",
            entityId: `${QA_MARKER}:manual-correction`,
            action: "attendance.correction.approved",
            actorUserId: hrUser.id,
            actorEmail: hrUser.email,
            metadata: JSON.stringify({ date: "2026-06-18", oldCheckIn: "09:42", newCheckIn: "09:01", reason: "biometric_failure" }),
            createdAt: utcDay(19, 11),
          },
          {
            entityType: "attendance",
            entityId: `${QA_MARKER}:regularization-rejected`,
            action: "attendance.regularization.rejected",
            actorUserId: hrUser.id,
            actorEmail: hrUser.email,
            metadata: JSON.stringify({ date: "2026-06-10", issue: "missing_checkin", state: "rejected" }),
            createdAt: utcDay(11, 16),
          },
          {
            entityType: "employee",
            entityId: `${QA_MARKER}:profile-update`,
            action: "employee.updated",
            actorUserId: hrUser.id,
            actorEmail: hrUser.email,
            metadata: JSON.stringify({ employeeId: employee.id, fields: ["department", "designation", "shift"] }),
            createdAt: utcDay(2, 12),
          },
          {
            entityType: "payroll",
            entityId: `${QA_MARKER}:payroll-generated`,
            action: "payroll.generated",
            actorUserId: hrUser.id,
            actorEmail: hrUser.email,
            metadata: JSON.stringify({
              employeeId: employee.id,
              gross: 92000,
              bonus: 5000,
              overtime: 8400,
              tax: 9200,
              attendanceDeduction: 2750,
              net: 93450,
            }),
            createdAt: utcDay(30, 20),
          },
        ],
      });

      const metricSeeds = [
        { metricKey: "attendance_rate", value: 83.33 },
        { metricKey: "overtime_hours", value: Number((otMinutes / 60).toFixed(2)) },
        { metricKey: "leave_days", value: 3.5 },
      ];
      for (const metric of metricSeeds) {
        await tx.workforceMetric.upsert({
          where: {
            scope_scopeKey_metricKey_period_periodStart: {
              scope: AnalyticsScope.employee,
              scopeKey: String(employee.id),
              metricKey: metric.metricKey,
              period: MetricPeriod.monthly,
              periodStart: PERIOD_START,
            },
          },
          create: {
            scope: AnalyticsScope.employee,
            scopeKey: String(employee.id),
            metricKey: metric.metricKey,
            period: MetricPeriod.monthly,
            periodStart: PERIOD_START,
            periodEnd: PERIOD_END,
            value: metric.value,
            metadata: JSON.stringify({ qaSeed: QA_MARKER }),
            computedAt: utcDay(30, 21),
          },
          update: {
            periodEnd: PERIOD_END,
            value: metric.value,
            metadata: JSON.stringify({ qaSeed: QA_MARKER }),
            computedAt: utcDay(30, 21),
          },
        });
      }

      await tx.analyticsSnapshot.deleteMany({
        where: { correlationId: `${QA_MARKER}:snapshot` },
      });
      await tx.analyticsSnapshot.create({
        data: {
          snapshotType: "employee_monthly_summary",
          scope: AnalyticsScope.employee,
          scopeKey: String(employee.id),
          payload: JSON.stringify({
            qaSeed: QA_MARKER,
            employeeId: employee.id,
            attendanceDays: 30,
            approvedLeaveDays: 3.5,
            overtimeMinutes: otMinutes,
            lateCount,
            netSalary: 93450,
          }),
          periodStart: PERIOD_START,
          periodEnd: PERIOD_END,
          generatedAt: utcDay(30, 21),
          correlationId: `${QA_MARKER}:snapshot`,
        },
      });

      await tx.anomalyDetection.deleteMany({
        where: {
          scope: AnalyticsScope.employee,
          scopeKey: String(employee.id),
          metadata: { contains: QA_MARKER },
        },
      });
      await tx.anomalyDetection.createMany({
        data: [
          {
            anomalyType: "missing_punch",
            severity: AnomalySeverity.medium,
            scope: AnalyticsScope.employee,
            scopeKey: String(employee.id),
            title: "Repeated missing attendance punches",
            description: "John Doe has one missing check-in and one missing checkout.",
            explanation: "Biometric failure and pending regularization scenarios were detected.",
            metadata: JSON.stringify({ qaSeed: QA_MARKER, dates: ["2026-06-09", "2026-06-10"] }),
            detectedAt: utcDay(10, 20),
          },
          {
            anomalyType: "high_overtime",
            severity: AnomalySeverity.high,
            scope: AnalyticsScope.employee,
            scopeKey: String(employee.id),
            title: "High overtime during June",
            description: "Weekend, holiday, night, and double-shift work increased overtime.",
            explanation: "Review workload and overtime approval records.",
            metadata: JSON.stringify({ qaSeed: QA_MARKER, overtimeMinutes: otMinutes }),
            detectedAt: utcDay(30, 21),
          },
        ],
      });

      await tx.integrationJob.deleteMany({
        where: { correlationId: `${QA_MARKER}:analytics` },
      });
      await tx.integrationJob.create({
        data: {
          jobType: "analytics_aggregate",
          status: "completed",
          payload: JSON.stringify({ qaSeed: QA_MARKER, employeeId: employee.id }),
          attempts: 1,
          correlationId: `${QA_MARKER}:analytics`,
          scheduledAt: utcDay(30, 20),
          completedAt: utcDay(30, 21),
          createdAt: utcDay(30, 20),
        },
      });
    },
    { maxWait: 10_000, timeout: 60_000 }
  );

  console.log(
    `Seeded ${QA_MARKER} for ${employee.employeeCode}: 30 attendance days, 7 leave requests, payroll, notifications, audits, workflows, and analytics.`
  );
}
