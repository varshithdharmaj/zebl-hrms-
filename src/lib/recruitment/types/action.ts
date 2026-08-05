import type { ActionState as PlatformActionState } from "@/actions/types";

/** Re-export platform ActionState — do not invent a parallel shape. */
export type ActionState = PlatformActionState;

export type ActionResult<T> =
  | { ok: true; data: T; state?: ActionState }
  | { ok: false; state: ActionState };
