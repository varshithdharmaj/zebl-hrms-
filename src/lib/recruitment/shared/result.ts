import type { ActionState } from "@/lib/recruitment/types/action";
import type { ActionResult } from "@/lib/recruitment/types/action";
import {
  isRecruitmentDomainError,
  RecruitmentDomainError,
} from "@/lib/recruitment/shared/errors";
import { PermissionError } from "@/lib/permissions";

export function okResult<T>(data: T, success?: string): ActionResult<T> {
  return { ok: true, data, state: success ? { success } : undefined };
}

export function failResult<T = never>(error: string): ActionResult<T> {
  return { ok: false, state: { error } };
}

export function toActionState(result: ActionResult<unknown>): ActionState {
  if (result.ok) return result.state ?? { success: "OK" };
  return result.state;
}

export function mapUnknownToActionState(error: unknown): ActionState {
  if (isRecruitmentDomainError(error)) {
    return { error: error.message };
  }
  if (error instanceof PermissionError) {
    return { error: error.message };
  }
  // Avoid leaking Prisma/internal stack details to clients.
  return { error: "Unexpected error." };
}

export function assertNever(value: never): never {
  throw new RecruitmentDomainError("REC_INTERNAL", `Unhandled value: ${String(value)}`);
}
