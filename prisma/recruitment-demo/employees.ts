import bcrypt from "bcryptjs";
import { AuthProvider, UserRole } from "@/generated/prisma/client";
import { DEMO_PASSWORD, STAFF } from "./catalog";
import { log, type DemoCtx } from "./helpers";

export async function seedEmployees(ctx: DemoCtx): Promise<void> {
  log("Staff (10)…");
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  for (const s of STAFF) {
    const emp = await ctx.prisma.employee.upsert({
      where: { employeeCode: s.code },
      create: {
        employeeCode: s.code,
        name: s.name,
        firstName: s.name.split(" ")[0],
        lastName: s.name.split(" ").slice(1).join(" ") || null,
        email: s.email,
        department: s.dept,
        designation: s.title,
        employmentType: "Full Time",
        workLocation: "Hyderabad",
        employeeStatus: "Active",
        isActive: true,
        joiningDate: new Date("2022-03-01T00:00:00.000Z"),
      },
      update: {
        name: s.name,
        email: s.email,
        department: s.dept,
        designation: s.title,
        isActive: true,
      },
    });

    await ctx.prisma.employeeLeaveBalance.upsert({
      where: { employeeId: emp.id },
      create: { employeeId: emp.id, elBalance: 15, clBalance: 12, slBalance: 12 },
      update: {},
    });

    const role =
      s.role === "hr" ? UserRole.hr : UserRole.employee;

    const user = await ctx.prisma.user.upsert({
      where: { email: s.email },
      create: {
        email: s.email,
        password: hash,
        role,
        authProvider: AuthProvider.local,
        isActive: true,
        employeeId: emp.id,
      },
      update: {
        password: hash,
        role,
        isActive: true,
        employeeId: emp.id,
      },
    });

    await ctx.prisma.notificationPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });

    ctx.staff.set(s.key, {
      id: emp.id,
      userId: user.id,
      email: s.email,
      name: s.name,
    });
  }

  const hr = ctx.staff.get("hr_head")!;
  const eng = ctx.staff.get("hm_eng")!;
  await ctx.prisma.employee.update({
    where: { id: ctx.staff.get("rec_1")!.id },
    data: { managerId: hr.id },
  });
  await ctx.prisma.employee.update({
    where: { id: ctx.staff.get("rec_2")!.id },
    data: { managerId: hr.id },
  });
  await ctx.prisma.employee.update({
    where: { id: ctx.staff.get("iv_tech")!.id },
    data: { managerId: eng.id },
  });
  await ctx.prisma.employee.update({
    where: { id: ctx.staff.get("emp_1")!.id },
    data: { managerId: eng.id },
  });

  for (const tag of [
    "__min_demo__",
    "source:linkedin",
    "source:referral",
    "source:career_page",
    "source:naukri",
    "source:campus",
  ]) {
    await ctx.prisma.recruitmentTag.upsert({
      where: { name: tag },
      create: { name: tag, color: "#0369a1" },
      update: {},
    });
  }

  ctx.counts.employees = STAFF.length;
}
