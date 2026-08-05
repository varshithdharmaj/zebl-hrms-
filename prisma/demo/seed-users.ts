import bcrypt from "bcryptjs";
import {
  AuthProvider,
  UserRole,
  type PrismaClient,
} from "@/generated/prisma/client";
import {
  DEMO_PASSWORD,
  DEMO_TAG,
  DEMO_USERS,
  SOURCE_CATALOG,
  type DemoUserKey,
} from "./constants";
import type { DemoActor, DemoSeedContext } from "./context";
import { logStep } from "./helpers";

export async function seedUsers(ctx: DemoSeedContext): Promise<void> {
  logStep("Seeding demo users & staff employees…");
  const { prisma } = ctx;
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const actors = {} as Record<DemoUserKey, DemoActor>;

  for (const def of DEMO_USERS) {
    const employee = await prisma.employee.upsert({
      where: { employeeCode: def.employeeCode },
      create: {
        employeeCode: def.employeeCode,
        name: def.name,
        firstName: def.name.split(" ")[0],
        lastName: def.name.split(" ").slice(1).join(" ") || null,
        email: def.email,
        department: def.department,
        designation: def.designation,
        employmentType: "Full Time",
        workLocation: "Hyderabad",
        employeeStatus: "Active",
        isActive: true,
        joiningDate: new Date("2022-01-15T00:00:00.000Z"),
      },
      update: {
        name: def.name,
        email: def.email,
        department: def.department,
        designation: def.designation,
        isActive: true,
        employeeStatus: "Active",
      },
    });

    await prisma.employeeLeaveBalance.upsert({
      where: { employeeId: employee.id },
      create: {
        employeeId: employee.id,
        elBalance: 15,
        clBalance: 12,
        slBalance: 12,
      },
      update: {
        elBalance: 15,
        clBalance: 12,
        slBalance: 12,
      },
    });

    const role =
      def.role === "super_admin"
        ? UserRole.super_admin
        : def.role === "hr"
          ? UserRole.hr
          : UserRole.employee;

    const user = await prisma.user.upsert({
      where: { email: def.email },
      create: {
        email: def.email,
        password: passwordHash,
        role,
        authProvider: AuthProvider.local,
        isActive: true,
        sessionVersion: 1,
        employeeId: employee.id,
      },
      update: {
        password: passwordHash,
        role,
        authProvider: AuthProvider.local,
        isActive: true,
        employeeId: employee.id,
      },
    });

    await prisma.notificationPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });

    actors[def.key] = {
      userId: user.id,
      employeeId: employee.id,
      email: def.email,
      name: def.name,
      role: def.role,
    };
  }

  // Link managers for hierarchy
  await prisma.employee.update({
    where: { id: actors.hiring_manager.employeeId },
    data: { managerId: actors.eng_manager.employeeId },
  });
  await prisma.employee.update({
    where: { id: actors.recruiter1.employeeId },
    data: { managerId: actors.hr_manager.employeeId },
  });
  await prisma.employee.update({
    where: { id: actors.recruiter2.employeeId },
    data: { managerId: actors.hr_manager.employeeId },
  });

  const demoTag = await prisma.recruitmentTag.upsert({
    where: { name: DEMO_TAG },
    create: { name: DEMO_TAG, color: "#64748b" },
    update: {},
  });

  const tagIds: Record<string, string> = { [DEMO_TAG]: demoTag.id };
  for (const src of SOURCE_CATALOG) {
    const tag = await prisma.recruitmentTag.upsert({
      where: { name: src.tag },
      create: { name: src.tag, color: "#0ea5e9" },
      update: {},
    });
    tagIds[src.tag] = tag.id;
  }

  ctx.actors = actors;
  ctx.actorList = Object.values(actors);
  ctx.recruiters = [actors.recruiter1, actors.recruiter2, actors.hr_manager];
  ctx.demoTagId = demoTag.id;
  ctx.tagIds = tagIds;
  ctx.counts.users = DEMO_USERS.length;

  logStep(`Users ready (${DEMO_USERS.length} accounts).`);
}

export async function resolveExistingHrActor(
  prisma: PrismaClient
): Promise<{ userId: string; email: string } | null> {
  const hr = await prisma.user.findUnique({
    where: { email: "hr@zebl.com" },
    select: { id: true, email: true },
  });
  return hr ? { userId: hr.id, email: hr.email } : null;
}
