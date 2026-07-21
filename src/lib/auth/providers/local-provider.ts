import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { toAppUserRole, WORKFORCE_ROLES, type AppUserRole } from "@/lib/roles";
import type { AuthResult } from "@/lib/auth/auth-types";
import type { LocalCredentials } from "@/lib/auth/providers/auth-types";
import { buildSessionUser } from "@/lib/auth/session-bridge";

function isWorkforceRole(role: AppUserRole): boolean {
  return WORKFORCE_ROLES.includes(role);
}

function isPrismaInitError(e: unknown): boolean {
  const name = e instanceof Error ? e.constructor.name : "";
  return name === "PrismaClientInitializationError";
}

export async function authenticateLocalUser(
  credentials: LocalCredentials
): Promise<AuthResult> {
  const email = credentials.email.toLowerCase().trim();
  let user;
  try {
    user = await prisma.user.findUnique({
      where: { email },
      include: { employee: true },
    });
  } catch (e) {
    if (isPrismaInitError(e)) {
      console.error(
        "[zebl] Database misconfigured — DATABASE_URL must be postgresql://. Run: npm run db:check-env"
      );
      return {
        ok: false,
        code: "service_unavailable",
        message:
          "Database is not configured. Contact your administrator or fix DATABASE_URL in .env.",
      };
    }
    throw e;
  }

  if (!user || !user.password) {
    return { ok: false, code: "invalid_credentials", message: "Invalid email or password." };
  }

  const valid = await bcrypt.compare(credentials.password, user.password);
  if (!valid) {
    return { ok: false, code: "invalid_credentials", message: "Invalid email or password." };
  }

  if (!user.isActive) {
    return {
      ok: false,
      code: "inactive_employee",
      message: "Your account has been deactivated. Contact your administrator.",
    };
  }

  if (
    isWorkforceRole(toAppUserRole(user.role)) &&
    user.employee &&
    (user.employee.employeeStatus !== "Active" || !user.employee.isActive)
  ) {
    return {
      ok: false,
      code: "inactive_employee",
      message: "Your employee account is inactive. Contact HR.",
    };
  }

  return { ok: true, user: buildSessionUser(user) };
}
