import type { AppUserRole } from "@/lib/roles";

/** Authenticated actor for recruitment permission/scope resolution. */
export type RecruitmentActor = {
  userId: string;
  email: string;
  role: AppUserRole;
  employeeId: number | null;
  /** Permanent User.recruitmentOpsAccess — defaults false when omitted. */
  recruitmentOpsAccess?: boolean;
};
