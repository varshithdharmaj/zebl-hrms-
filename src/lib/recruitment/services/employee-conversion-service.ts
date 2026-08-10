import { prisma } from "@/lib/prisma";
import { ApplicationStatus, RecruitmentPipelineStage, CandidateStatus, OfferStatus } from "@/generated/prisma/enums";
import type { SessionUser } from "@/lib/session";
import {
  RecruitmentPermissionService,
  toRecruitmentActor,
} from "@/lib/recruitment/permissions/permission-service";
import { RecruitmentScopeEngine } from "@/lib/recruitment/permissions/recruitment-scope-engine";
import { prismaConversionRepository } from "@/lib/recruitment/repositories/prisma-conversion-repository";
import type { ConversionRepository } from "@/lib/recruitment/repositories/conversion-repository";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { withRecruitmentTransaction } from "@/lib/recruitment/shared/transaction";
import { createAfterCommitBuffer } from "@/lib/recruitment/shared/after-commit";
import { RecruitmentEventFactory } from "@/lib/recruitment/events/factory";
import { RecruitmentTimelineService } from "@/lib/recruitment/services/timeline-service";
import { convertEmployeeSchema } from "@/lib/validation/schemas/recruitment/conversions";
import { initializeEmployeeLeaveBalances } from "@/lib/leave";
import { provisionEmployeeLogin } from "@/lib/admin/user-management";
import { copyRecruitmentDocsToEmployee } from "@/lib/recruitment/services/conversion-document-transfer";
import { getRecruitmentStorage, type StorageAdapter } from "@/lib/recruitment/storage";
import type {
  ConversionHistoryItem,
  EmployeeConversionPreviewData,
  PendingConversionListItem,
} from "@/lib/recruitment/conversion/types";
import { Prisma } from "@/generated/prisma/client";

function generateEmployeeCode(): string {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `EMP-${rand}`;
}

function decimalToNumber(
  value: Prisma.Decimal | number | string | null | undefined
): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return Number(value.toString());
}

export function createEmployeeConversionService(
  repository: ConversionRepository = prismaConversionRepository,
  storage: StorageAdapter = getRecruitmentStorage()
) {
  return {
    async previewConversion(
      session: SessionUser,
      offerId: string
    ): Promise<{
      candidate: {
        id: string;
        fullName: string;
        email: string | null;
        phone: string | null;
        status: string;
      };
      application: {
        id: string;
        jobOpeningId: string;
        jobTitle: string;
        currentStage: string;
      } | null;
      offer: {
        id: string;
        offerNumber: string | null;
        status: string;
        ctc: number;
        currency: string;
        joiningDate: string;
        department: string;
        location: string;
      };
      employeePreview: EmployeeConversionPreviewData;
      checklist: {
        offerAccepted: boolean;
        candidateActive: boolean;
        noDuplicateEmployee: boolean;
        joiningDateValid: boolean;
        departmentExists: boolean;
        managerExists: boolean;
      };
      blockingErrors: string[];
    }> {
      RecruitmentPermissionService.requireConversionEnabled();
      RecruitmentPermissionService.requireHrAdministration(session);

      const offer = await prisma.offer.findUnique({
        where: { id: offerId },
        include: {
          application: {
            include: {
              candidate: true,
              jobOpening: true,
            },
          },
        },
      });

      if (!offer) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Offer not found.");
      }

      const application = offer.application;
      const candidate = application.candidate;

      // Check if already converted
      const existingSnapshot = await prisma.employeeConversionSnapshot.findUnique({
        where: { offerId },
      });

      const offerAccepted = offer.status === OfferStatus.accepted;
      const candidateActive = candidate.status === CandidateStatus.active || candidate.status === CandidateStatus.talent_pool || candidate.status === CandidateStatus.hired;
      
      const emailExists = candidate.email
        ? await repository.employeeExists(candidate.email, "")
        : false;
      const noDuplicateEmployee = !existingSnapshot && !emailExists;

      const joiningDateValid = !!offer.joiningDate;
      const departmentExists = !!offer.department;
      
      const managerExists = offer.reportingManagerId
        ? await prisma.employee.count({ where: { id: offer.reportingManagerId } }).then(c => c > 0)
        : true;

      const blockingErrors: string[] = [];
      if (!offerAccepted) blockingErrors.push("Offer must be accepted before conversion.");
      if (existingSnapshot) blockingErrors.push("This offer has already been converted.");
      if (emailExists) blockingErrors.push("An employee with this email already exists.");

      // Split candidate name into first and last name
      const nameParts = candidate.fullName.trim().split(/\s+/);
      const firstName = candidate.firstName || nameParts[0] || "";
      const lastName = candidate.lastName || nameParts.slice(1).join(" ") || "";

      const employeePreview = {
        employeeCode: generateEmployeeCode(),
        name: candidate.fullName,
        firstName,
        lastName,
        email: candidate.email,
        phone: candidate.phone,
        department: offer.department || "Engineering",
        designation: offer.employmentType || "Software Engineer",
        managerId: offer.reportingManagerId || null,
        employmentType: offer.employmentType || "Full-time",
        workLocation: offer.location || "Bangalore",
        joiningDate: offer.joiningDate ? new Date(offer.joiningDate).toISOString().slice(0, 10) : "",
        grade: offer.grade || "L1",
        ctc: offer.ctc ? Number(offer.ctc) : 0,
      };

      return {
        candidate: {
          id: candidate.id,
          fullName: candidate.fullName,
          email: candidate.email,
          phone: candidate.phone,
          status: candidate.status,
        },
        application: {
          id: application.id,
          jobOpeningId: application.jobOpening?.id ?? application.jobOpeningId ?? "",
          jobTitle: application.jobOpening?.title ?? "",
          currentStage: String(application.currentStage ?? ""),
        },
        offer: {
          id: offer.id,
          offerNumber: offer.offerNumber,
          status: offer.status,
          ctc: offer.ctc != null ? Number(offer.ctc) : 0,
          currency: offer.currency,
          joiningDate: offer.joiningDate
            ? new Date(offer.joiningDate).toISOString()
            : "",
          department: offer.department ?? "",
          location: offer.location ?? "",
        },
        employeePreview,
        checklist: {
          offerAccepted,
          candidateActive,
          noDuplicateEmployee,
          joiningDateValid,
          departmentExists,
          managerExists,
        },
        blockingErrors,
      };
    },

    async convertEmployee(
      session: SessionUser,
      input: unknown
    ): Promise<{ employeeId: number }> {
      RecruitmentPermissionService.requireConversionEnabled();
      RecruitmentPermissionService.requireHrAdministration(session);
      const actor = toRecruitmentActor(session);

      const parsed = convertEmployeeSchema.parse(input);

      // 1. Fetch offer and validate
      const offer = await prisma.offer.findUnique({
        where: { id: parsed.offerId },
        include: {
          application: {
            include: {
              candidate: true,
              jobOpening: true,
            },
          },
        },
      });

      if (!offer) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Offer not found.");
      }

      if (offer.status !== OfferStatus.accepted) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Only accepted offers can be converted to employees."
        );
      }

      // Check if already converted
      const existingSnapshot = await prisma.employeeConversionSnapshot.findUnique({
        where: { offerId: parsed.offerId },
      });
      if (existingSnapshot) {
        throw new RecruitmentDomainError(
          "REC_CONFLICT",
          "This offer has already been converted."
        );
      }

      // Check duplicate employee code or email
      const duplicateExists = await repository.employeeExists(
        parsed.email || "",
        parsed.employeeCode
      );
      if (duplicateExists) {
        throw new RecruitmentDomainError(
          "REC_CONFLICT",
          "An employee with this employee code or email already exists."
        );
      }

      const application = offer.application;
      const candidate = application.candidate;
      const jobOpening = application.jobOpening;

      const events = createAfterCommitBuffer();

      // 2. Run database updates in transaction
      const employeeId = await withRecruitmentTransaction(async (tx) => {
        // Create Employee
        const createdEmployee = await tx.employee.create({
          data: {
            employeeCode: parsed.employeeCode,
            name: parsed.name,
            firstName: parsed.name.split(/\s+/)[0] || "",
            lastName: parsed.name.split(/\s+/).slice(1).join(" ") || "",
            email: parsed.email || null,
            phone: parsed.phone || null,
            department: parsed.department,
            designation: parsed.designation,
            employmentType: parsed.employmentType,
            workLocation: parsed.workLocation,
            joiningDate: new Date(parsed.joiningDate),
            employeeStatus: "Active",
            isActive: true,
            managerId: parsed.managerId || null,
          },
        });

        // Copy primary resume (+ offer PDF) into employee storage (candidate docs untouched)
        const employeeDocuments = await copyRecruitmentDocsToEmployee({
          tx: tx as never,
          storage,
          candidateId: candidate.id,
          employeeId: createdEmployee.id,
          offerPdfKey: offer.offerPdfKey,
        });

        // Create Snapshot
        await repository.convert(
          {
            applicationId: application.id,
            candidateId: candidate.id,
            offerId: offer.id,
            employeeId: createdEmployee.id,
            fieldMapVersion: "1.0",
            mappedFields: {
              employeeCode: parsed.employeeCode,
              name: parsed.name,
              email: parsed.email,
              department: parsed.department,
              designation: parsed.designation,
              ctc: parsed.ctc,
              joiningDate: parsed.joiningDate,
              employeeDocuments,
            },
            convertedByUserId: session.id,
          },
          tx
        );

        // Update Application to Hired
        const fromStage = application.currentStage;
        await repository.updateApplication(
          application.id,
          ApplicationStatus.hired,
          RecruitmentPipelineStage.hired,
          tx
        );

        await tx.applicationStageHistory.create({
          data: {
            applicationId: application.id,
            fromStage,
            toStage: RecruitmentPipelineStage.hired,
            note: "Converted to employee",
            actorUserId: session.id,
          },
        });

        // Update Candidate to Hired
        await repository.updateCandidate(
          candidate.id,
          CandidateStatus.hired,
          createdEmployee.id,
          tx
        );

        // Increment Job Filled count and auto-fill if reached
        const { isFilled } = await repository.incrementJobFilled(jobOpening.id, tx);

        // Append Timeline Events
        await RecruitmentTimelineService.append(
          {
            entityType: "application",
            entityId: application.id,
            applicationId: application.id,
            candidateId: candidate.id,
            jobOpeningId: jobOpening.id,
            eventType: "employee_converted",
            summary: `Converted candidate ${candidate.fullName} to employee ${parsed.employeeCode}`,
            actorUserId: session.id,
            metadata: {
              employeeId: createdEmployee.id,
              employeeCode: parsed.employeeCode,
              documentsCopied: employeeDocuments.map((d) => d.kind),
            },
          },
          tx
        );

        if (isFilled) {
          await RecruitmentTimelineService.append(
            {
              entityType: "job_opening",
              entityId: jobOpening.id,
              applicationId: application.id,
              candidateId: candidate.id,
              jobOpeningId: jobOpening.id,
              eventType: "recruitment_closed",
              summary: `Job opening ${jobOpening.title} is now filled and closed.`,
              actorUserId: session.id,
              metadata: { jobOpeningId: jobOpening.id },
            },
            tx
          );
        }

        // Push events to buffer
        events.enqueue(
          RecruitmentEventFactory.employeeConverted(actor, {
            snapshotId: offer.id, // using offerId as snapshotId or we can fetch snapshot id
            applicationId: application.id,
            candidateId: candidate.id,
            offerId: offer.id,
            employeeId: createdEmployee.id,
          })
        );

        if (isFilled) {
          events.enqueue(
            RecruitmentEventFactory.recruitmentClosed(actor, {
              applicationId: application.id,
              candidateId: candidate.id,
            })
          );
        }

        return createdEmployee.id;
      });

      // 3. Post-transaction tasks
      // Initialize leave balances
      try {
        await initializeEmployeeLeaveBalances(
          employeeId,
          { el: 15, cl: 12, sl: 12 }, // standard default balances
          session.email
        );
      } catch (err) {
        console.error("Failed to initialize leave balances:", err);
      }

      // Provision login if requested
      if (parsed.createLogin && parsed.email && parsed.password) {
        try {
          await provisionEmployeeLogin(session, {
            employeeId,
            mode: "create",
            email: parsed.email,
            password: parsed.password,
            generate: false,
            mustChangePassword: true,
            auditOperation: "create_with_employee",
          });

          // Timeline event for account creation
          await RecruitmentTimelineService.append({
            entityType: "application",
            entityId: application.id,
            applicationId: application.id,
            candidateId: candidate.id,
            jobOpeningId: jobOpening.id,
            eventType: "employee_account_created",
            summary: `Created system login account for ${parsed.employeeCode}`,
            actorUserId: session.id,
            metadata: { employeeId, employeeCode: parsed.employeeCode },
          });

          events.enqueue(
            RecruitmentEventFactory.employeeCreated(actor, {
              employeeId,
              email: parsed.email,
            })
          );
        } catch (err) {
          console.error("Failed to provision employee login:", err);
        }
      }

      await events.flush();

      return { employeeId };
    },

    async listPendingConversions(
      session: SessionUser
    ): Promise<PendingConversionListItem[]> {
      RecruitmentPermissionService.requireModuleEnabled();
      const scope = await RecruitmentScopeEngine.getScope(session);

      const where =
        scope.mode === "unrestricted"
          ? {
              status: OfferStatus.accepted,
              conversionSnapshot: null,
            }
          : {
              status: OfferStatus.accepted,
              conversionSnapshot: null,
              OR: [
                { applicationId: { in: [...scope.applicationIds] } },
                {
                  application: {
                    OR: [
                      { jobOpeningId: { in: [...scope.jobOpeningIds] } },
                      { candidateId: { in: [...scope.candidateIds] } },
                    ],
                  },
                },
              ],
            };

      const offers = await prisma.offer.findMany({
        where,
        select: {
          id: true,
          offerNumber: true,
          acceptedAt: true,
          ctc: true,
          currency: true,
          createdBy: {
            select: { id: true, email: true },
          },
          application: {
            select: {
              candidate: {
                select: { id: true, fullName: true, email: true },
              },
              jobOpening: {
                select: { id: true, title: true },
              },
            },
          },
        },
        orderBy: {
          acceptedAt: "desc",
        },
      });

      return offers.map((offer) => ({
        id: offer.id,
        offerNumber: offer.offerNumber,
        acceptedAt: offer.acceptedAt,
        ctc: decimalToNumber(offer.ctc),
        currency: offer.currency,
        createdBy: offer.createdBy,
        application: {
          candidate: offer.application.candidate,
          jobOpening: offer.application.jobOpening,
        },
      }));
    },

    async listConversionHistory(session: SessionUser): Promise<ConversionHistoryItem[]> {
      RecruitmentPermissionService.requireModuleEnabled();

      const snapshots = await prisma.employeeConversionSnapshot.findMany({
        select: {
          id: true,
          convertedAt: true,
          application: {
            select: {
              candidate: {
                select: { id: true, fullName: true, email: true },
              },
              jobOpening: {
                select: { id: true, title: true },
              },
            },
          },
          employee: {
            select: { id: true, employeeCode: true },
          },
          convertedBy: {
            select: { id: true, email: true },
          },
        },
        orderBy: {
          convertedAt: "desc",
        },
      });

      return snapshots;
    },

    async getConversionDashboardMetrics(session: SessionUser) {
      RecruitmentPermissionService.requireModuleEnabled();
      
      const offersAccepted = await prisma.offer.count({
        where: { status: OfferStatus.accepted },
      });

      const employeesJoined = await prisma.employeeConversionSnapshot.count();

      const pendingConversions = await prisma.offer.count({
        where: {
          status: OfferStatus.accepted,
          conversionSnapshot: null,
        },
      });

      const conversionRate = offersAccepted > 0
        ? Math.round((employeesJoined / offersAccepted) * 100)
        : 0;

      return {
        offersAccepted,
        employeesJoined,
        pendingConversions,
        conversionRate,
      };
    },
  };
}
