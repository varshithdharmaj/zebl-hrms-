import { prisma } from "@/lib/prisma";

export async function getEmployeeById(id: number) {
  return prisma.employee.findUnique({
    where: { id },
    include: {
      user: { select: { email: true, role: true } },
      manager: {
        select: {
          id: true,
          employeeCode: true,
          name: true,
          department: true,
          designation: true,
        },
      },
      _count: { select: { directReports: true } },
    },
  });
}

export async function getEmployees(search?: string, limit = 200) {
  const where = search
    ? {
        OR: [
          { name: { contains: search.trim() } },
          { employeeCode: { contains: search.trim() } },
          { email: { contains: search.trim() } },
          { phone: { contains: search.trim() } },
        ],
      }
    : {};

  return prisma.employee.findMany({
    where,
    include: { user: { select: { email: true } } },
    orderBy: { name: "asc" },
    take: Math.min(Math.max(1, limit), 500),
  });
}
