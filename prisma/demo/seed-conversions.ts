import bcrypt from "bcryptjs";
import {
  AuthProvider,
  CandidateStatus,
  OfferStatus,
  Prisma,
  RecruitmentTimelineEntityType,
  UserRole,
} from "@/generated/prisma/client";
import { DEMO_PASSWORD, TARGETS } from "./constants";
import type { DemoSeedContext } from "./context";
import { demoMeta, logStep } from "./helpers";

/**
 * Convert ~20 accepted offers into employees + leave balances + optional login.
 * Uses Prisma directly (mirrors conversion service outcomes without importing server-only).
 */
export async function seedConversions(ctx: DemoSeedContext): Promise<void> {
  logStep(`Seeding employee conversions (target ${TARGETS.conversions})…`);
  const { prisma, offers, candidates, jobs, actors } = ctx;
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const accepted = offers.filter((o) => o.accepted || o.status === OfferStatus.accepted);
  const toConvert = accepted.slice(0, TARGETS.conversions);
  let converted = 0;

  for (let i = 0; i < toConvert.length; i++) {
    const offer = toConvert[i]!;
    const cand = candidates.find((c) => c.id === offer.candidateId);
    const job = jobs.find((j) => j.id === offer.jobOpeningId);
    if (!cand || !job) continue;

    const employeeCode = `DEMO-HIRE-${String(i + 1).padStart(3, "0")}`;

    await prisma.$transaction(async (tx) => {
      // Clean prior conversion for this offer/candidate if re-seeding
      const existingSnap = await tx.employeeConversionSnapshot.findFirst({
        where: {
          OR: [{ offerId: offer.id }, { candidateId: cand.id }, { applicationId: offer.applicationId }],
        },
      });
      if (existingSnap) {
        await tx.employeeConversionSnapshot.delete({ where: { id: existingSnap.id } });
        const oldEmpId = existingSnap.employeeId;
        await tx.candidate.update({
          where: { id: cand.id },
          data: { employeeId: null, status: CandidateStatus.active },
        });
        await tx.user.deleteMany({ where: { employeeId: oldEmpId } });
        await tx.leaveTransaction.deleteMany({ where: { employeeId: oldEmpId } });
        await tx.employeeLeaveBalance.deleteMany({ where: { employeeId: oldEmpId } });
        await tx.employee.deleteMany({ where: { id: oldEmpId } });
      }

      // Ensure offer is accepted
      await tx.offer.update({
        where: { id: offer.id },
        data: {
          status: OfferStatus.accepted,
          acceptedAt: offer.joiningDate,
        },
      });

      const existingEmp = await tx.employee.findUnique({ where: { employeeCode } });
      if (existingEmp) {
        await tx.user.deleteMany({ where: { employeeId: existingEmp.id } });
        await tx.leaveTransaction.deleteMany({ where: { employeeId: existingEmp.id } });
        await tx.employeeLeaveBalance.deleteMany({ where: { employeeId: existingEmp.id } });
        await tx.employee.delete({ where: { id: existingEmp.id } });
      }

      const employee = await tx.employee.create({
        data: {
          employeeCode,
          name: cand.fullName,
          firstName: cand.fullName.split(" ")[0],
          lastName: cand.fullName.split(" ").slice(1).join(" ") || null,
          email: cand.email.replace("@candidate-demo.local", "@zebl-demo.local"),
          phone: cand.phone,
          department: offer.department,
          designation: job.title,
          employmentType:
            offer.employmentType === "intern"
              ? "Intern"
              : offer.employmentType === "contract"
                ? "Contract"
                : "Full Time",
          workLocation: offer.location,
          joiningDate: offer.joiningDate,
          employeeStatus: "Active",
          isActive: true,
          managerId: job.hmEmployeeId,
        },
      });

      await tx.employeeLeaveBalance.create({
        data: {
          employeeId: employee.id,
          elBalance: 15,
          clBalance: 12,
          slBalance: 12,
        },
      });

      await tx.leaveTransaction.createMany({
        data: [
          {
            employeeId: employee.id,
            leaveType: "EL",
            transactionType: "manual_adjustment",
            amount: 15,
            reason: "Initial balance on employee creation",
            createdBy: actors.hr_manager.email,
          },
          {
            employeeId: employee.id,
            leaveType: "CL",
            transactionType: "manual_adjustment",
            amount: 12,
            reason: "Initial balance on employee creation",
            createdBy: actors.hr_manager.email,
          },
          {
            employeeId: employee.id,
            leaveType: "SL",
            transactionType: "manual_adjustment",
            amount: 12,
            reason: "Initial balance on employee creation",
            createdBy: actors.hr_manager.email,
          },
        ],
      });

      // Create login for every other conversion
      if (i % 2 === 0) {
        const loginEmail = `hire.${String(i + 1).padStart(3, "0")}@zebl-demo.local`;
        await tx.user.create({
          data: {
            email: loginEmail,
            password: passwordHash,
            role: UserRole.employee,
            authProvider: AuthProvider.local,
            isActive: true,
            employeeId: employee.id,
          },
        });
      }

      await tx.candidate.update({
        where: { id: cand.id },
        data: {
          employeeId: employee.id,
          status: CandidateStatus.hired,
        },
      });

      await tx.application.update({
        where: { id: offer.applicationId },
        data: {
          status: "hired",
          currentStage: "hired",
        },
      });

      await tx.employeeConversionSnapshot.create({
        data: {
          applicationId: offer.applicationId,
          candidateId: cand.id,
          offerId: offer.id,
          employeeId: employee.id,
          fieldMapVersion: "demo-v1",
          mappedFields: {
            name: cand.fullName,
            email: cand.email,
            department: offer.department,
            designation: job.title,
            ctc: offer.baseSalary,
            demoSeed: true,
          } satisfies Prisma.InputJsonValue,
          convertedByUserId: actors.hr_manager.userId,
          convertedAt: offer.joiningDate,
        },
      });

      await tx.recruitmentTimelineEvent.create({
        data: {
          entityType: RecruitmentTimelineEntityType.candidate,
          entityId: cand.id,
          applicationId: offer.applicationId,
          candidateId: cand.id,
          jobOpeningId: offer.jobOpeningId,
          eventType: "conversion.completed",
          summary: `Converted to employee ${employeeCode}`,
          actorUserId: actors.hr_manager.userId,
          metadata: demoMeta({ employeeCode, employeeId: employee.id }),
          createdAt: offer.joiningDate,
        },
      });
    });

    converted += 1;
  }

  ctx.counts.conversions = converted;
  logStep(`Conversions ready (${converted}).`);
}
