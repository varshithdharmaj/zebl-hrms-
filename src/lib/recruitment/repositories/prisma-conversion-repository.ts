import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { ApplicationStatus, RecruitmentPipelineStage, CandidateStatus, OfferStatus, JobOpeningStatus } from "@/generated/prisma/enums";
import type { ConversionRepository } from "@/lib/recruitment/repositories/conversion-repository";
import type { RepositoryTx } from "@/lib/recruitment/repositories/types";

type Client = RepositoryTx;

export const prismaConversionRepository: ConversionRepository = {
  async convert(data, tx) {
    const client: Client = tx ?? prisma;
    const created = await client.employeeConversionSnapshot.create({
      data: {
        applicationId: data.applicationId,
        candidateId: data.candidateId,
        offerId: data.offerId,
        employeeId: data.employeeId,
        fieldMapVersion: data.fieldMapVersion,
        mappedFields: data.mappedFields,
        overrideReason: data.overrideReason ?? null,
        convertedByUserId: data.convertedByUserId,
      },
    });
    return { id: created.id };
  },

  async employeeExists(email, employeeCode) {
    const count = await prisma.employee.count({
      where: {
        OR: [
          { email: { equals: email, mode: "insensitive" } },
          { employeeCode: { equals: employeeCode, mode: "insensitive" } },
        ],
      },
    });
    return count > 0;
  },

  async updateApplication(id, status, currentStage, tx) {
    const client: Client = tx ?? prisma;
    await client.application.update({
      where: { id },
      data: {
        status,
        currentStage,
        stageEnteredAt: new Date(),
      },
    });
  },

  async updateCandidate(id, status, employeeId, tx) {
    const client: Client = tx ?? prisma;
    await client.candidate.update({
      where: { id },
      data: {
        status,
        employeeId,
      },
    });
  },

  async updateOffer(id, status, tx) {
    const client: Client = tx ?? prisma;
    await client.offer.update({
      where: { id },
      data: {
        status,
      },
    });
  },

  async incrementJobFilled(jobOpeningId, tx) {
    const client: Client = tx ?? prisma;
    
    // Count hired applications for this job opening
    const filledCount = await client.application.count({
      where: {
        jobOpeningId,
        status: ApplicationStatus.hired,
        deletedAt: null,
      },
    });

    // Get job opening openings count
    const job = await client.jobOpening.findUnique({
      where: { id: jobOpeningId },
      select: { openingsCount: true, status: true },
    });

    const targetCount = job?.openingsCount ?? 1;
    const isFilled = filledCount >= targetCount;

    if (isFilled && job?.status !== JobOpeningStatus.filled) {
      await client.jobOpening.update({
        where: { id: jobOpeningId },
        data: {
          status: JobOpeningStatus.filled,
          filledAt: new Date(),
        },
      });
    }

    return {
      filledCount,
      targetCount,
      isFilled,
    };
  },

  async insertSnapshot(data, tx) {
    const client: Client = tx ?? prisma;
    const created = await client.employeeConversionSnapshot.create({
      data: {
        applicationId: data.applicationId as string,
        candidateId: data.candidateId as string,
        offerId: data.offerId as string,
        employeeId: data.employeeId as number,
        fieldMapVersion: (data.fieldMapVersion as string) ?? "1.0",
        mappedFields: (data.mappedFields as Prisma.InputJsonValue) ?? {},
        overrideReason: (data.overrideReason as string) ?? null,
        convertedByUserId: data.convertedByUserId as string,
      },
    });
    return { id: created.id };
  },

  async findByApplicationId(applicationId) {
    const row = await prisma.employeeConversionSnapshot.findUnique({
      where: { applicationId },
    });
    return row ? (row as any) : null;
  },

  async findByCandidateId(candidateId) {
    const row = await prisma.employeeConversionSnapshot.findUnique({
      where: { candidateId },
    });
    return row ? (row as any) : null;
  },

  async findByEmployeeId(employeeId) {
    const row = await prisma.employeeConversionSnapshot.findUnique({
      where: { employeeId },
    });
    return row ? (row as any) : null;
  },
};
