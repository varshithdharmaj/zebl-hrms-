import { notFound } from "next/navigation";
import { LeaveWorkflowStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { EmployeeProfileShell } from "@/components/admin/employee-profile/profile-shell";
import { getEmployeeProfileLeaveData } from "@/actions/leave-balances";
import { getEmployeeAttendanceSummary, getEmployeeById } from "@/lib/queries";
import { getManagerCandidates } from "@/lib/org";
import { defaultDateRange } from "@/lib/utils";
import type { EmployeeStatus } from "@/lib/employee-types";

export default async function EmployeeProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const { id: idStr } = await params;
  const { start, end } = await searchParams;
  const id = parseInt(idStr, 10);

  if (Number.isNaN(id)) notFound();

  const employee = await getEmployeeById(id);
  if (!employee) notFound();

  const { start: defaultStart, end: defaultEnd } = defaultDateRange();

  const [attendance, leaveData, managerCandidates] = await Promise.all([
    getEmployeeAttendanceSummary(id, start, end),
    getEmployeeProfileLeaveData(id),
    getManagerCandidates(id),
  ]);

  const [pendingLeaves, approvedLeavesYtd] = await Promise.all([
    prisma.leaveRequest.count({
      where: {
        employeeId: id,
        workflowStatus: LeaveWorkflowStatus.pending_approval,
      },
    }),
    prisma.leaveRequest.count({
      where: {
        employeeId: id,
        workflowStatus: LeaveWorkflowStatus.approved,
        createdAt: { gte: new Date(new Date().getFullYear(), 0, 1) },
      },
    }),
  ]);

  const overviewStats = {
    pendingLeaves,
    approvedLeavesYtd,
    attendancePercent: attendance.attendancePercent,
    lastAttendance: attendance.lastAttendanceDate,
  };

  const profileEmployee = {
    id: employee.id,
    employeeCode: employee.employeeCode,
    name: employee.name,
    email: employee.email,
    phone: employee.phone,
    department: employee.department,
    designation: employee.designation,
    shift: employee.shift,
    joiningDate: employee.joiningDate,
    employeeStatus: employee.employeeStatus as EmployeeStatus,
    user: employee.user,
    manager: employee.manager,
    directReportsCount: employee._count.directReports,
  };

  return (
    <EmployeeProfileShell
      employee={profileEmployee}
      attendance={attendance}
      balances={leaveData.balances}
      history={leaveData.history}
      defaultStart={defaultStart}
      defaultEnd={defaultEnd}
      managerCandidates={managerCandidates}
      overviewStats={overviewStats}
    />
  );
}
