import { PermissionError } from "@/lib/permissions";
import type { SessionUser } from "@/lib/session";

export const PASSWORD_CHANGE_REQUIRED_MESSAGE = "Password change required";

export class PasswordChangeRequiredError extends PermissionError {
  constructor(message = PASSWORD_CHANGE_REQUIRED_MESSAGE) {
    super(message);
    this.name = "PasswordChangeRequiredError";
  }
}

/**
 * Local accounts flagged mustChangePassword may authenticate and use the
 * password-change / logout flows only. SSO (microsoft) is not blocked —
 * those users have no local password to rotate.
 */
export function sessionRequiresPasswordChange(session: SessionUser): boolean {
  return session.mustChangePassword === true && session.authProvider === "local";
}

export function assertPasswordChangeComplete(session: SessionUser): void {
  if (sessionRequiresPasswordChange(session)) {
    throw new PasswordChangeRequiredError();
  }
}

export function isPasswordChangeAllowedPath(pathname: string): boolean {
  return pathname === "/change-password" || pathname.startsWith("/change-password/");
}
