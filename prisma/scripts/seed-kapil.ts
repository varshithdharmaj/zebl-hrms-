/**
 * Idempotent seed: employee Kapil + login + leave balances + recent attendance + sample leave/ticket.
 * Run: npx tsx prisma/scripts/seed-kapil.ts
 */
import bcrypt from "bcryptjs";
import {
  PrismaClient,
  UserRole,
  AuthProvider,
  LeaveRequestStatus,
  LeaveWorkflowStatus,
  TicketCategory,
  TicketType,
  TicketPriority,
  TicketStatus,
} from "@/generated/prisma/client";

const prisma = new PrismaClient();

const EMP_CODE = "EMP-KAPIL";
const EMAIL = "kapil@zebl.com";
const PASSWORD = "Employee@2026";

function startOfDayLocal(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

type DaySeed = {
  offset: number;
  checkIn: string | null;
  checkOut: string | null;
  workedMinutes: number;
  overtimeMinutes: number;
  status: string;
  remarks: string;
};

function recentAttendanceSeeds(): DaySeed[] {
  return [
    {
      offset: 0,
      checkIn: "09:08",
      checkOut: "18:15",
      workedMinutes: 487,
      overtimeMinutes: 7,
      status: "Present",
      remarks: "Office · biometric punch",
    },
    {
      offset: 1,
      checkIn: "09:02",
      checkOut: "18:05",
      workedMinutes: 483,
      overtimeMinutes: 3,
      status: "Present",
      remarks: "Office · on time",
    },
    {
      offset: 2,
      checkIn: "09:35",
      checkOut: "18:10",
      workedMinutes: 455,
      overtimeMinutes: 0,
      status: "Short Hours",
      remarks: "Late arrival · traffic",
    },
    {
      offset: 3,
      checkIn: "08:55",
      checkOut: "18:40",
      workedMinutes: 525,
      overtimeMinutes: 45,
      status: "Present",
      remarks: "Overtime · release support",
    },
    {
      offset: 4,
      checkIn: "09:00",
      checkOut: "13:05",
      workedMinutes: 245,
      overtimeMinutes: 0,
      status: "Short Hours",
      remarks: "Half day · personal appointment",
    },
    {
      offset: 5,
      checkIn: null,
      checkOut: null,
      workedMinutes: 0,
      overtimeMinutes: 0,
      status: "Absent",
      remarks: "Unplanned absence",
    },
    {
      offset: 7,
      checkIn: "09:04",
      checkOut: "18:02",
      workedMinutes: 478,
      overtimeMinutes: 0,
      status: "Present",
      remarks: "Work From Home · VPN verified",
    },
    {
      offset: 8,
      checkIn: "09:01",
      checkOut: "18:20",
      workedMinutes: 499,
      overtimeMinutes: 19,
      status: "Present",
      remarks: "Office · sprint planning",
    },
    {
      offset: 9,
      checkIn: "09:12",
      checkOut: "18:00",
      workedMinutes: 468,
      overtimeMinutes: 0,
      status: "Short Hours",
      remarks: "Slightly late",
    },
    {
      offset: 10,
      checkIn: "09:00",
      checkOut: "18:05",
      workedMinutes: 485,
      overtimeMinutes: 5,
      status: "Present",
      remarks: "Office · biometric punch",
    },
  ];
}

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const joiningDate = new Date("2024-03-15T00:00:00.000Z");

  const employee = await prisma.employee.upsert({
    where: { employeeCode: EMP_CODE },
    create: {
      employeeCode: EMP_CODE,
      name: "Kapil Sharma",
      firstName: "Kapil",
      lastName: "Sharma",
      preferredName: "Kapil",
      gender: "Male",
      dateOfBirth: new Date("1995-08-12T00:00:00.000Z"),
      email: EMAIL,
      phone: "+91 98765 43210",
      alternatePhone: "+91 98765 00011",
      address: "221B Residency Road, Bengaluru, KA 560025",
      emergencyContact: "Anita Sharma · +91 98765 11122",
      department: "Engineering",
      designation: "Software Engineer",
      employmentType: "Full-time",
      workLocation: "Bengaluru",
      shift: "Morning Shift",
      joiningDate,
      employeeStatus: "Active",
      isActive: true,
    },
    update: {
      name: "Kapil Sharma",
      firstName: "Kapil",
      lastName: "Sharma",
      preferredName: "Kapil",
      email: EMAIL,
      phone: "+91 98765 43210",
      department: "Engineering",
      designation: "Software Engineer",
      employmentType: "Full-time",
      workLocation: "Bengaluru",
      shift: "Morning Shift",
      employeeStatus: "Active",
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: EMAIL },
    create: {
      email: EMAIL,
      password: passwordHash,
      role: UserRole.employee,
      authProvider: AuthProvider.local,
      sessionVersion: 1,
      isActive: true,
      employeeId: employee.id,
      mustChangePassword: false,
    },
    update: {
      password: passwordHash,
      role: UserRole.employee,
      authProvider: AuthProvider.local,
      isActive: true,
      employeeId: employee.id,
      mustChangePassword: false,
    },
  });

  await prisma.employeeLeaveBalance.upsert({
    where: { employeeId: employee.id },
    create: {
      employeeId: employee.id,
      elBalance: 8.5,
      clBalance: 6,
      slBalance: 10,
    },
    update: {
      elBalance: 8.5,
      clBalance: 6,
      slBalance: 10,
    },
  });

  let attendanceCount = 0;
  for (const row of recentAttendanceSeeds()) {
    if (row.offset === 0) continue; // today handled as multi-session below
    const d = startOfDayLocal();
    d.setDate(d.getDate() - row.offset);
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    const record = await prisma.attendanceRecord.upsert({
      where: {
        employeeId_attendanceDate: {
          employeeId: employee.id,
          attendanceDate: d,
        },
      },
      create: {
        employeeId: employee.id,
        attendanceDate: d,
        shift: "Morning Shift",
        checkIn: row.checkIn,
        checkOut: row.checkOut,
        workDuration: duration(row.workedMinutes),
        workedMinutes: row.workedMinutes,
        overtimeMinutes: row.overtimeMinutes,
        status: row.status,
        remarks: row.remarks,
      },
      update: {
        shift: "Morning Shift",
        checkIn: row.checkIn,
        checkOut: row.checkOut,
        workDuration: duration(row.workedMinutes),
        workedMinutes: row.workedMinutes,
        overtimeMinutes: row.overtimeMinutes,
        status: row.status,
        remarks: row.remarks,
      },
    });

    if (row.checkIn) {
      await prisma.attendanceSession.deleteMany({ where: { attendanceId: record.id } });
      await prisma.attendanceSession.create({
        data: {
          attendanceId: record.id,
          checkIn: row.checkIn,
          checkOut: row.checkOut,
          workedMinutes: row.workedMinutes,
        },
      });
    }
    attendanceCount += 1;
  }

  // Multi-session verification day: 09:00→12:00 + 13:00→18:00 = 480m (8h)
  const today = startOfDayLocal();
  if (today.getDay() !== 0 && today.getDay() !== 6) {
    const dayRecord = await prisma.attendanceRecord.upsert({
      where: {
        employeeId_attendanceDate: {
          employeeId: employee.id,
          attendanceDate: today,
        },
      },
      create: {
        employeeId: employee.id,
        attendanceDate: today,
        shift: "Morning Shift",
        checkIn: "09:00",
        checkOut: "18:00",
        workDuration: "08:00",
        workedMinutes: 480,
        overtimeMinutes: 0,
        status: "Present",
        remarks: "Multi-session seed · 09:00–12:00 + 13:00–18:00",
      },
      update: {
        checkIn: "09:00",
        checkOut: "18:00",
        workDuration: "08:00",
        workedMinutes: 480,
        overtimeMinutes: 0,
        status: "Present",
        remarks: "Multi-session seed · 09:00–12:00 + 13:00–18:00",
      },
    });

    await prisma.attendanceSession.deleteMany({ where: { attendanceId: dayRecord.id } });
    await prisma.attendanceSession.createMany({
      data: [
        {
          attendanceId: dayRecord.id,
          checkIn: "09:00",
          checkOut: "12:00",
          workedMinutes: 180,
        },
        {
          attendanceId: dayRecord.id,
          checkIn: "13:00",
          checkOut: "18:00",
          workedMinutes: 300,
        },
      ],
    });
    attendanceCount += 1;
  }

  const leaveStart = startOfDayLocal();
  leaveStart.setDate(leaveStart.getDate() + 5);
  const leaveEnd = startOfDayLocal();
  leaveEnd.setDate(leaveEnd.getDate() + 6);

  const existingLeave = await prisma.leaveRequest.findFirst({
    where: {
      employeeId: employee.id,
      reason: { contains: "Family function · Kapil seed" },
    },
  });

  if (!existingLeave) {
    await prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        leaveType: "CL",
        startDate: leaveStart,
        endDate: leaveEnd,
        days: 2,
        reason: "Family function · Kapil seed",
        status: LeaveRequestStatus.pending,
        workflowStatus: LeaveWorkflowStatus.pending_approval,
        submittedAt: new Date(),
      },
    });
  }

  const existingTicket = await prisma.ticket.findFirst({
    where: {
      raisedByEmployeeId: employee.id,
      subject: "Laptop charger not working",
    },
  });

  if (!existingTicket) {
    const year = new Date().getFullYear();
    const count = await prisma.ticket.count();
    const ticketNumber = `TKT-${year}-${String(count + 1).padStart(5, "0")}`;

    await prisma.ticket.create({
      data: {
        ticketNumber,
        category: TicketCategory.it_technical,
        type: TicketType.service_request,
        priority: TicketPriority.medium,
        status: TicketStatus.new,
        subject: "Laptop charger not working",
        description:
          "My laptop charger stopped working yesterday. Need a replacement ASAP for WFH days.",
        isAnonymous: false,
        raisedByEmployeeId: employee.id,
        department: "Engineering",
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        employeeId: employee.id,
        employeeCode: employee.employeeCode,
        name: employee.name,
        email: EMAIL,
        password: PASSWORD,
        attendanceRecords: attendanceCount,
        leaveBalance: { EL: 8.5, CL: 6, SL: 10 },
        notes: [
          "Pending CL leave request (2 days, upcoming)",
          "Open IT ticket: Laptop charger not working",
        ],
      },
      null,
      2
    )
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
