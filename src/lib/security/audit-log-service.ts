import type { Prisma } from "@prisma/client";
import {
  writeAuditLog,
  type WriteAuditLogInput,
} from "@/lib/audit";
import { getRequestSecurityContext } from "@/lib/security/request-context";

export type AuditEventInput = Omit<WriteAuditLogInput, "requestContext"> & {
  captureRequestContext?: boolean;
};

export async function recordAuditEvent(
  input: AuditEventInput,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const { captureRequestContext = true, ...event } = input;
  const requestContext = captureRequestContext
    ? await getRequestSecurityContext()
    : undefined;
  await writeAuditLog({ ...event, requestContext }, tx);
}

export const AuditLogService = {
  record: recordAuditEvent,
};
