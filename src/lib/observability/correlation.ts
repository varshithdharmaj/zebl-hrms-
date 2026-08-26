import { randomUUID } from "crypto";

export function createCorrelationId(prefix?: string): string {
  const id = randomUUID().slice(0, 12);
  return prefix ? `${prefix}-${id}` : id;
}

export function workflowCorrelationId(leaveId: number, stepId?: number): string {
  return stepId ? `leave-${leaveId}-step-${stepId}` : `leave-${leaveId}`;
}
