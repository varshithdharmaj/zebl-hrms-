import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { RegularizationRequestType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { applyApprovedRegularization, getISTDateParts } from "@/lib/integrations/biometric-attendance-derivation";
import {
  isRequestTypeConsistentWithSessions,
  type OverlaySession,
} from "@/lib/attendance/regularization/overlay";
import { assertRegularizationEligible } from "@/lib/attendance/regularization/eligibility";
import {
  queueRegularizationDecisionNotice,
  queueRegularizationSubmittedAlert,
} from "@/lib/attendance/regularization/notifications";
import { MIN_REJECTION_COMMENT_LENGTH } from "@/lib/workflow/workflow-types";

export const MIN_REGULARIZATION_REASON_LENGTH = 10;

export class RegularizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegularizationError";
  }
}

export type RegularizationActor = {
  userId: string;
  email: string;
  role: "employee" | "manager" | "hr" | "super_admin";
  employeeId: number | null;
};

function attendanceDateLabel(date: Date): string {
  return getISTDateParts(date).dateString;
}

async function auditRegularization(
  params: {
    requestId: number;
    action: string;
    actor: RegularizationActor;
    employeeId: number;
    metadata: Record<string, unknown>;
  },
  tx: Prisma.TransactionClient
): Promise<void> {
  await writeAuditLog(
    {
      entityType: "attendance_regularization_request",
      entityId: String(params.requestId),
      action: params.action,
      actorUserId: params.actor.userId,
      actorEmail: params.actor.email,
      employeeId: params.employeeId,
      module: "attendance",
      metadata: params.metadata,
    },
    tx
  );
}

/**
 * Optimistic-lock claim, same idiom as leave-workflow.ts's claimLeaveVersion:
 * UPDATE ... WHERE version = expected AND status = pending. Zero rows means
 * another actor (HR admin, or the employee cancelling) already moved it.
 */
async function claimRequestVersion(
  tx: Prisma.TransactionClient,
  requestId: number,
  expectedVersion: number
): Promise<void> {
  const result = await tx.attendanceRegularizationRequest.updateMany({
    where: { id: requestId, version: expectedVersion, status: "pending" },
    data: { version: { increment: 1 } },
  });
  if (result.count === 0) {
    throw new RegularizationError(
      "This request was already actioned or updated by another user. Please refresh and try again."
    );
  }
}

export type OwnRegularizationRequestDto = {
  id: number;
  attendanceDate: Date;
  requestType: RegularizationRequestType;
  requestedCheckIn: string | null;
  requestedCheckOut: string | null;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  version: number;
  submittedAt: Date;
  reviewComment: string | null;
  reviewedAt: Date | null;
};

/** Employee-facing list — deliberately excludes snapshotBefore/provenance detail (kept for HR UI only). */
export async function listOwnRegularizationRequests(
  employeeId: number
): Promise<OwnRegularizationRequestDto[]> {
  const rows = await prisma.attendanceRegularizationRequest.findMany({
    where: { employeeId },
    orderBy: [{ submittedAt: "desc" }],
    take: 50,
  });
  return rows.map((r) => ({
    id: r.id,
    attendanceDate: r.attendanceDate,
    requestType: r.requestType,
    requestedCheckIn: r.requestedCheckIn,
    requestedCheckOut: r.requestedCheckOut,
    reason: r.reason,
    status: r.status,
    version: r.version,
    submittedAt: r.submittedAt,
    reviewComment: r.reviewComment,
    reviewedAt: r.reviewedAt,
  }));
}

export type HrRegularizationRequestDto = OwnRegularizationRequestDto & {
  employeeId: number;
  employeeName: string;
  employeeCode: string;
  checkOutNextDay: boolean;
  reviewedBy: string | null;
  snapshotBefore: unknown;
};

/** HR queue — carries the full provenance/snapshot detail the employee UI omits. */
export async function listRegularizationRequestsForReview(
  filter: { status?: "pending" | "approved" | "rejected" | "cancelled" } = {}
): Promise<HrRegularizationRequestDto[]> {
  const rows = await prisma.attendanceRegularizationRequest.findMany({
    where: filter.status ? { status: filter.status } : {},
    orderBy: [{ submittedAt: "desc" }],
    take: 100,
    include: { employee: { select: { name: true, employeeCode: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    employeeName: r.employee.name,
    employeeCode: r.employee.employeeCode,
    attendanceDate: r.attendanceDate,
    requestType: r.requestType,
    requestedCheckIn: r.requestedCheckIn,
    requestedCheckOut: r.requestedCheckOut,
    checkOutNextDay: r.checkOutNextDay,
    reason: r.reason,
    status: r.status,
    version: r.version,
    submittedAt: r.submittedAt,
    reviewComment: r.reviewComment,
    reviewedAt: r.reviewedAt,
    reviewedBy: r.reviewedBy,
    snapshotBefore: r.snapshotBefore,
  }));
}

export async function submitRegularizationRequest(params: {
  actor: RegularizationActor;
  attendanceDate: Date;
  requestType: RegularizationRequestType;
  requestedCheckIn: string | null;
  requestedCheckOut: string | null;
  checkOutNextDay: boolean;
  reason: string;
  previousRequestId?: number;
}): Promise<{ requestId: number }> {
  const employeeId = params.actor.employeeId;
  if (employeeId == null) {
    throw new RegularizationError("No employee profile linked to this account.");
  }

  const reason = params.reason.trim();
  if (reason.length < MIN_REGULARIZATION_REASON_LENGTH) {
    throw new RegularizationError(
      `Reason must be at least ${MIN_REGULARIZATION_REASON_LENGTH} characters.`
    );
  }

  const dateParts = getISTDateParts(params.attendanceDate);

  await assertRegularizationEligible({
    employeeId,
    attendanceDate: dateParts.attendanceDate,
  });

  if (params.previousRequestId) {
    const previous = await prisma.attendanceRegularizationRequest.findUnique({
      where: { id: params.previousRequestId },
      select: { employeeId: true, status: true, resubmittedAs: { select: { id: true } } },
    });
    if (!previous || previous.employeeId !== employeeId || previous.status !== "rejected") {
      throw new RegularizationError("Invalid resubmission reference.");
    }
    if (previous.resubmittedAs) {
      throw new RegularizationError("This request has already been resubmitted.");
    }
  }

  const record = await prisma.attendanceRecord.findUnique({
    where: { employeeId_attendanceDate: { employeeId, attendanceDate: dateParts.attendanceDate } },
    include: { sessions: { orderBy: [{ checkIn: "asc" }, { id: "asc" }] } },
  });
  const baseSessions: OverlaySession[] =
    record?.sessions.map((s) => ({ checkIn: s.checkIn, checkOut: s.checkOut })) ?? [];

  if (!isRequestTypeConsistentWithSessions(params.requestType, baseSessions)) {
    throw new RegularizationError(
      "This request type doesn't match the current attendance data for this day. Use 'Attendance missing' or 'Device failure' if the punch data is inconsistent."
    );
  }

  const snapshotBefore = {
    checkIn: record?.checkIn ?? null,
    checkOut: record?.checkOut ?? null,
    workedMinutes: record?.workedMinutes ?? 0,
    status: record?.status ?? "Absent",
    remarks: record?.remarks ?? null,
    sessions: baseSessions,
  };

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { name: true },
  });

  try {
    const requestId = await prisma.$transaction(async (tx) => {
      const created = await tx.attendanceRegularizationRequest.create({
        data: {
          employeeId,
          attendanceDate: dateParts.attendanceDate,
          requestType: params.requestType,
          requestedCheckIn: params.requestedCheckIn,
          requestedCheckOut: params.requestedCheckOut,
          checkOutNextDay: params.checkOutNextDay,
          reason,
          snapshotBefore,
          previousRequestId: params.previousRequestId ?? null,
        },
      });

      await auditRegularization(
        {
          requestId: created.id,
          action: AUDIT_ACTIONS.ATTENDANCE_REGULARIZATION,
          actor: params.actor,
          employeeId,
          metadata: {
            requestType: params.requestType,
            attendanceDate: dateParts.dateString,
            operation: "submit",
            resubmissionOf: params.previousRequestId ?? null,
          },
        },
        tx
      );

      return created.id;
    });

    await queueRegularizationSubmittedAlert({
      requestId,
      employeeName: employee?.name ?? `Employee #${employeeId}`,
      attendanceDateLabel: dateParts.dateString,
    });

    return { requestId };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new RegularizationError(
        "You already have a pending regularisation request for this date."
      );
    }
    throw error;
  }
}

export async function cancelRegularizationRequest(params: {
  actor: RegularizationActor;
  requestId: number;
}): Promise<void> {
  const employeeId = params.actor.employeeId;
  if (employeeId == null) throw new RegularizationError("No employee profile linked to this account.");

  const now = new Date();
  const result = await prisma.attendanceRegularizationRequest.updateMany({
    where: { id: params.requestId, employeeId, status: "pending" },
    data: { status: "cancelled", cancelledAt: now },
  });
  if (result.count === 0) {
    throw new RegularizationError("This request can no longer be cancelled.");
  }

  await writeAuditLog({
    entityType: "attendance_regularization_request",
    entityId: String(params.requestId),
    action: AUDIT_ACTIONS.ATTENDANCE_REGULARIZATION_CANCELLED,
    actorUserId: params.actor.userId,
    actorEmail: params.actor.email,
    employeeId,
    module: "attendance",
    metadata: { operation: "cancel" },
  });
}

/**
 * Single atomic transaction: claim → re-validate → apply the overlay to
 * AttendanceRecord/AttendanceSession → mark approved. If any step throws,
 * the whole transaction rolls back, so the request can never end up
 * APPROVED while the attendance correction failed to apply.
 */
export async function approveRegularizationRequest(params: {
  actor: RegularizationActor;
  requestId: number;
  expectedVersion: number;
  reviewComment?: string;
}): Promise<void> {
  if (params.actor.role !== "hr" && params.actor.role !== "super_admin") {
    throw new RegularizationError("Only HR administrators can approve regularisation requests.");
  }

  const request = await prisma.attendanceRegularizationRequest.findUnique({
    where: { id: params.requestId },
    include: { employee: { select: { id: true, name: true, email: true } } },
  });
  if (!request) throw new RegularizationError("Regularisation request not found.");
  if (request.status !== "pending") {
    throw new RegularizationError("This request has already been actioned.");
  }

  // Re-validate: state may have changed since submission (e.g. leave got
  // approved for this date in the meantime).
  await assertRegularizationEligible({
    employeeId: request.employeeId,
    attendanceDate: request.attendanceDate,
  });

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await claimRequestVersion(tx, params.requestId, params.expectedVersion);

    await applyApprovedRegularization(tx, {
      id: request.id,
      employeeId: request.employeeId,
      attendanceDate: request.attendanceDate,
    });

    await tx.attendanceRegularizationRequest.update({
      where: { id: params.requestId },
      data: {
        status: "approved",
        reviewedBy: params.actor.email,
        reviewedAt: now,
        reviewComment: params.reviewComment ?? null,
        appliedAt: now,
      },
    });

    await auditRegularization(
      {
        requestId: params.requestId,
        action: AUDIT_ACTIONS.ATTENDANCE_REGULARIZATION,
        actor: params.actor,
        employeeId: request.employeeId,
        metadata: { operation: "approve", attendanceDate: attendanceDateLabel(request.attendanceDate) },
      },
      tx
    );
    await auditRegularization(
      {
        requestId: params.requestId,
        action: AUDIT_ACTIONS.ATTENDANCE_APPROVED,
        actor: params.actor,
        employeeId: request.employeeId,
        metadata: {
          operation: "attendance_corrected",
          attendanceDate: attendanceDateLabel(request.attendanceDate),
          requestType: request.requestType,
        },
      },
      tx
    );
  });

  await queueRegularizationDecisionNotice({
    requestId: params.requestId,
    employeeEmail: request.employee.email,
    attendanceDateLabel: attendanceDateLabel(request.attendanceDate),
    approved: true,
    reviewComment: params.reviewComment ?? null,
  });
}

export async function rejectRegularizationRequest(params: {
  actor: RegularizationActor;
  requestId: number;
  expectedVersion: number;
  reviewComment: string;
}): Promise<void> {
  if (params.actor.role !== "hr" && params.actor.role !== "super_admin") {
    throw new RegularizationError("Only HR administrators can reject regularisation requests.");
  }

  const trimmed = params.reviewComment.trim();
  if (trimmed.length < MIN_REJECTION_COMMENT_LENGTH) {
    throw new RegularizationError(
      `Rejection comment must be at least ${MIN_REJECTION_COMMENT_LENGTH} characters.`
    );
  }

  const request = await prisma.attendanceRegularizationRequest.findUnique({
    where: { id: params.requestId },
    include: { employee: { select: { id: true, email: true } } },
  });
  if (!request) throw new RegularizationError("Regularisation request not found.");
  if (request.status !== "pending") {
    throw new RegularizationError("This request has already been actioned.");
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await claimRequestVersion(tx, params.requestId, params.expectedVersion);

    await tx.attendanceRegularizationRequest.update({
      where: { id: params.requestId },
      data: {
        status: "rejected",
        reviewedBy: params.actor.email,
        reviewedAt: now,
        reviewComment: trimmed,
      },
    });

    await auditRegularization(
      {
        requestId: params.requestId,
        action: AUDIT_ACTIONS.ATTENDANCE_REGULARIZATION_REJECTED,
        actor: params.actor,
        employeeId: request.employeeId,
        metadata: { operation: "reject", comment: trimmed },
      },
      tx
    );
  });

  await queueRegularizationDecisionNotice({
    requestId: params.requestId,
    employeeEmail: request.employee.email,
    attendanceDateLabel: attendanceDateLabel(request.attendanceDate),
    approved: false,
    reviewComment: trimmed,
  });
}
