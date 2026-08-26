/**
 * Centralized read models (data access layer).
 * Import from `@/lib/data` in pages and server components.
 */
export { PAGE_SIZE, RANGE_RECORD_LIMIT } from "@/lib/data/constants";
export {
  getEmployeeDashboardData,
  getEmployeeAttendanceSummary,
  getAttendanceRecords,
  getEmployeeAttendanceHistory,
} from "@/lib/data/attendance";
export { getEmployeeById, getEmployees } from "@/lib/data/employees";
export { getLeaveRequests, getEmployeeLeavePageData } from "@/lib/data/leaves";
export { getManagerDashboardStats } from "@/lib/data/dashboard";
