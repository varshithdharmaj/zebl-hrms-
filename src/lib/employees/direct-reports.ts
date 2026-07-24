import { cache } from "react";
import { prisma } from "@/lib/prisma";

/**
 * Whether the employee manages anyone (line-manager nav affordance).
 * Request-memoized — safe to call from multiple server components in one RSC request.
 */
export const employeeHasDirectReports = cache(async (employeeId: number): Promise<boolean> => {
  const count = await prisma.employee.count({
    where: { managerId: employeeId },
  });
  return count > 0;
});
