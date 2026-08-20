import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  deriveAttendanceForAffectedGroups,
  getISTDateParts,
  type AffectedEmployeeDateGroup,
} from "@/lib/integrations/biometric-attendance-derivation";

import {
  ESSL_TABLE_NAME_REGEX,
  biometricPunchEventSchema,
  ingestBiometricPunchesSchema,
  type IngestBiometricPunchEventInput,
  type IngestBiometricPunchesInput,
} from "@/lib/integrations/biometric-punch-schema";

export {
  ESSL_TABLE_NAME_REGEX,
  biometricPunchEventSchema,
  ingestBiometricPunchesSchema,
  type IngestBiometricPunchEventInput,
  type IngestBiometricPunchesInput,
};

export type IngestEventStatus = "success" | "duplicate" | "unmapped";

export type IngestEventResult = {
  deviceLogId: number;
  status: IngestEventStatus;
};

export type IngestBiometricPunchesResponse = {
  processedCount: number;
  duplicateCount: number;
  unmappedCount: number;
  results: IngestEventResult[];
};

/**
 * Core service function for ingesting raw biometric punch events.
 *
 * Performance & Database Guarantee:
 * - Single query to resolve all employeeCodes in the batch.
 * - Single query to fetch existing idempotency keys (source, tableName, deviceLogId).
 * - Single atomic createMany query with skipDuplicates: true for database safety.
 * - Raw events are persisted even when employee mapping is missing (employeeId = null).
 */
export async function ingestBiometricPunches(
  input: unknown
): Promise<IngestBiometricPunchesResponse> {
  const parsed = ingestBiometricPunchesSchema.parse(input);

  // 1. Normalize fields
  const normalizedEvents = parsed.events.map((e) => ({
    ...e,
    source: e.source.trim().toUpperCase(),
    tableName: e.tableName.trim(),
    employeeCode: e.employeeCode.trim(),
  }));

  // 2. Resolve employees by employeeCode
  const uniqueEmployeeCodes = Array.from(
    new Set(normalizedEvents.map((e) => e.employeeCode))
  );

  const employees = await prisma.employee.findMany({
    where: {
      employeeCode: { in: uniqueEmployeeCodes },
    },
    select: {
      id: true,
      employeeCode: true,
    },
  });

  const employeeIdMap = new Map<string, number>(
    employees.map((emp) => [emp.employeeCode, emp.id])
  );

  // 3. Query existing biometric punch idempotency keys
  const uniqueEventTuples = normalizedEvents.map((e) => ({
    source: e.source,
    tableName: e.tableName,
    deviceLogId: e.deviceLogId,
  }));

  const existingPunches = await prisma.biometricPunch.findMany({
    where: {
      OR: uniqueEventTuples,
    },
    select: {
      source: true,
      tableName: true,
      deviceLogId: true,
    },
  });

  const existingDbKeys = new Set<string>(
    existingPunches.map((p) => `${p.source}|${p.tableName}|${p.deviceLogId}`)
  );

  // 4. Process batch items for response and insert payload
  const seenKeysInBatch = new Set<string>();
  const results: IngestEventResult[] = [];
  const recordsToInsert: Array<{
    source: string;
    tableName: string;
    deviceLogId: number;
    employeeCode: string;
    employeeId: number | null;
    punchedAt: Date;
    deviceId: number;
    metadata: Prisma.InputJsonValue;
  }> = [];

  let processedCount = 0;
  let duplicateCount = 0;
  let unmappedCount = 0;

  for (const event of normalizedEvents) {
    const key = `${event.source}|${event.tableName}|${event.deviceLogId}`;

    if (existingDbKeys.has(key) || seenKeysInBatch.has(key)) {
      duplicateCount++;
      results.push({
        deviceLogId: event.deviceLogId,
        status: "duplicate",
      });
      continue;
    }

    seenKeysInBatch.add(key);

    const employeeId = employeeIdMap.get(event.employeeCode) ?? null;
    const status: IngestEventStatus = employeeId !== null ? "success" : "unmapped";

    if (status === "success") {
      processedCount++;
    } else {
      unmappedCount++;
    }

    results.push({
      deviceLogId: event.deviceLogId,
      status,
    });

    recordsToInsert.push({
      source: event.source,
      tableName: event.tableName,
      deviceLogId: event.deviceLogId,
      employeeCode: event.employeeCode,
      employeeId,
      punchedAt: event.punchedAt,
      deviceId: event.deviceId,
      metadata: (event.metadata ?? {}) as Prisma.InputJsonValue,
    });
  }

  // 5. Atomic persistence of new events
  if (recordsToInsert.length > 0) {
    await prisma.biometricPunch.createMany({
      data: recordsToInsert,
      skipDuplicates: true,
    });

    // 6. Derive attendance for affected employee/date groups
    const affectedMappedRecords = recordsToInsert.filter(
      (r): r is typeof r & { employeeId: number } => r.employeeId !== null
    );

    if (affectedMappedRecords.length > 0) {
      const affectedGroups: AffectedEmployeeDateGroup[] = affectedMappedRecords.map((r) => {
        const parts = getISTDateParts(r.punchedAt);
        return {
          employeeId: r.employeeId,
          attendanceDate: parts.attendanceDate,
          dateString: parts.dateString,
        };
      });

      await deriveAttendanceForAffectedGroups(affectedGroups);
    }
  }

  return {
    processedCount,
    duplicateCount,
    unmappedCount,
    results,
  };
}
