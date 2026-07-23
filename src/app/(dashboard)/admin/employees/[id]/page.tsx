import { notFound } from "next/navigation";
import { LeaveWorkflowStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { EmployeeProfileShell } from "@/components/admin/employee-profile/profile-shell";
import { getEmployeeProfileLeaveData } from "@/actions/leave-balances";
import { getEmployeeAttendanceSummary, getEmployeeById } from "@/lib/queries";
import { getManagerCandidates } from "@/lib/org";
import { defaultDateRange } from "@/lib/utils";
import type { EmployeeStatus } from "@/lib/employee-types";
import { getSession } from "@/lib/auth";
import { toAppUserRole } from "@/lib/roles";

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
  const session = await getSession();
  if (!session) notFound();

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
    firstName: employee.firstName,
    lastName: employee.lastName,
    preferredName: employee.preferredName,
    gender: employee.gender,
    dateOfBirth: employee.dateOfBirth,
    email: employee.email,
    phone: employee.phone,
    alternatePhone: employee.alternatePhone,
    address: employee.address,
    emergencyContact: employee.emergencyContact,
    department: employee.department,
    designation: employee.designation,
    employmentType: employee.employmentType,
    workLocation: employee.workLocation,
    shift: employee.shift,
    joiningDate: employee.joiningDate,
    employeeStatus: employee.employeeStatus as EmployeeStatus,
    user: employee.user
      ? { ...employee.user, role: toAppUserRole(employee.user.role) }
      : null,
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
      currentUserId={session.id}
      currentUserRole={session.role}
    />
  );
}
