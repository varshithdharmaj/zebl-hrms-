/** Shared org types — safe to import from client components (no Prisma). */

export type ManagerSummary = {
  id: number;
  employeeCode: string;
  name: string;
  department: string | null;
  designation: string | null;
};
