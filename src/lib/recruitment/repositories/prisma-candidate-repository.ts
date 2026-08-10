import { Prisma } from "@/generated/prisma/client";
import {
  CandidateStatus,
  CandidateSource,
  RecruitmentDocumentType,
  NoteVisibility,
  AiInsightType,
  AiInsightStatus,
  IntakeItemStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { RepositoryTx } from "@/lib/recruitment/repositories/types";
import type { RecruitmentScope } from "@/lib/recruitment/types/scope";
import {
  normalizePagination,
  paginationSkip,
  toPageResult,
} from "@/lib/recruitment/shared/pagination";
import type {
  CandidateDetail,
  CandidateListItem,
  CandidateListFilters,
  CandidateSort,
  CandidatePersonalView,
  CandidateExperienceView,
  CandidateEducationView,
  CandidateSkillView,
  CandidateProjectView,
  CandidateCertificationView,
  CandidateDocumentView,
  CandidateNoteView,
} from "@/lib/recruitment/candidate/types";
import type { CandidateRepository } from "@/lib/recruitment/repositories/candidate-repository";
import type { PaginationInput } from "@/lib/recruitment/repositories/types";

type Client = RepositoryTx;

function decimalToString(value: Prisma.Decimal | null | undefined): string | null {
  if (value == null) return null;
  return value.toString();
}

function parseEnum<T extends string>(value: unknown, values: readonly T[], fallback: T): T {
  return typeof value === "string" && (values as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function parseEnumOptional<T extends string>(
  value: unknown,
  values: readonly T[]
): T | undefined {
  return typeof value === "string" && (values as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

const detailInclude = {
  personal: true,
  experiences: { orderBy: { sortOrder: "asc" } },
  educations: { orderBy: { sortOrder: "asc" } },
  skills: true,
  projects: { orderBy: { sortOrder: "asc" } },
  certifications: true,
  documents: { where: { deletedAt: null } },
  notes: {
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      author: {
        select: {
          email: true,
          role: true,
          profilePhotoUrl: true,
          employee: { select: { name: true } },
        },
      },
    },
  },
} as const;

const noteAuthorInclude = {
  author: {
    select: {
      email: true,
      role: true,
      profilePhotoUrl: true,
      employee: { select: { name: true } },
    },
  },
} as const;

type CandidateDetailRow = Prisma.CandidateGetPayload<{ include: typeof detailInclude }>;
type CandidateListRow = Prisma.CandidateGetPayload<object>;
type CandidateDocumentRow = Prisma.CandidateDocumentGetPayload<object>;
type CandidateNoteRow = Prisma.CandidateNoteGetPayload<{ include: typeof noteAuthorInclude }>;

function mapPersonal(row: CandidateDetailRow["personal"]): CandidatePersonalView | null {
  if (!row) return null;
  return {
    candidateId: row.candidateId,
    nationality: row.nationality,
    currentLocation: row.currentLocation,
    preferredLocation: row.preferredLocation,
    noticePeriod: row.noticePeriod,
    availabilityDate: row.availabilityDate,
    linkedinUrl: row.linkedinUrl,
    portfolioUrl: row.portfolioUrl,
  };
}

function mapExperience(row: CandidateDetailRow["experiences"][number]): CandidateExperienceView {
  return {
    id: row.id,
    candidateId: row.candidateId,
    company: row.company,
    title: row.title,
    location: row.location,
    startDate: row.startDate,
    endDate: row.endDate,
    isCurrent: row.isCurrent,
    description: row.description,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    companyName: row.companyName,
    designation: row.designation,
    employmentType: row.employmentType,
    currentlyWorking: row.currentlyWorking,
  };
}

function mapEducation(row: CandidateDetailRow["educations"][number]): CandidateEducationView {
  return {
    id: row.id,
    candidateId: row.candidateId,
    institution: row.institution,
    degree: row.degree,
    field: row.field,
    startYear: row.startYear,
    endYear: row.endYear,
    notes: row.notes,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    fieldOfStudy: row.fieldOfStudy,
    grade: row.grade,
  };
}

function mapSkill(row: CandidateDetailRow["skills"][number]): CandidateSkillView {
  return {
    id: row.id,
    candidateId: row.candidateId,
    name: row.name,
    proficiency: row.proficiency,
    isConfirmed: row.isConfirmed,
    createdAt: row.createdAt,
    skillName: row.skillName,
    yearsOfExperience: row.yearsOfExperience,
  };
}

function mapProject(row: CandidateDetailRow["projects"][number]): CandidateProjectView {
  return {
    id: row.id,
    candidateId: row.candidateId,
    title: row.title,
    summary: row.summary,
    techStack: row.techStack,
    url: row.url,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    description: row.description,
    technologies: row.technologies,
    role: row.role,
    duration: row.duration,
  };
}

function mapCertification(
  row: CandidateDetailRow["certifications"][number]
): CandidateCertificationView {
  return {
    id: row.id,
    candidateId: row.candidateId,
    name: row.name,
    issuer: row.issuer,
    issuedAt: row.issuedAt,
    expiresAt: row.expiresAt,
    credentialId: row.credentialId,
    createdAt: row.createdAt,
    issueDate: row.issueDate,
    expiryDate: row.expiryDate,
    credentialUrl: row.credentialUrl,
  };
}

function mapDocument(row: CandidateDocumentRow): CandidateDocumentView {
  return {
    id: row.id,
    candidateId: row.candidateId,
    documentType: row.documentType,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    storageKey: row.storageKey,
    checksum: row.checksum,
    version: row.version,
    isPrimary: row.isPrimary,
    uploadedByUserId: row.uploadedByUserId,
    createdAt: row.createdAt,
    deletedAt: row.deletedAt,
    fileType: row.fileType,
    storagePath: row.storagePath,
    size: row.size,
  };
}

function mapNote(row: CandidateNoteRow): CandidateNoteView {
  const authorEmail = row.author?.email ?? "";
  const authorName =
    row.author?.employee?.name?.trim() ||
    authorEmail ||
    "Unknown";
  return {
    id: row.id,
    candidateId: row.candidateId,
    body: row.body,
    visibility: row.visibility,
    isPinned: row.isPinned,
    isResolved: row.isResolved,
    authorUserId: row.authorUserId,
    authorName,
    authorEmail,
    avatarUrl: row.author?.profilePhotoUrl ?? null,
    roleLabel: noteRoleLabel(row.author?.role),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    content: row.content,
  };
}

function mapDetail(row: CandidateDetailRow): CandidateDetail {
  return {
    id: row.id,
    tenantId: row.tenantId,
    fullName: row.fullName,
    firstName: row.firstName,
    lastName: row.lastName,
    preferredName: row.preferredName,
    email: row.email,
    phone: row.phone,
    alternatePhone: row.alternatePhone,
    dateOfBirth: row.dateOfBirth,
    location: row.location,
    currentCompany: row.currentCompany,
    currentTitle: row.currentTitle,
    linkedinUrl: row.linkedinUrl,
    professionalSummary: row.professionalSummary,
    headline: row.headline,
    totalExperienceYears: decimalToString(row.totalExperienceYears),
    githubUrl: row.githubUrl,
    preferredWorkMode: row.preferredWorkMode,
    willingToRelocate: row.willingToRelocate,
    source: row.source,
    status: row.status,
    doNotHireReason: row.doNotHireReason,
    currentCtc: decimalToString(row.currentCtc),
    expectedCtc: decimalToString(row.expectedCtc),
    currency: row.currency,
    noticePeriodDays: row.noticePeriodDays,
    earliestJoinDate: row.earliestJoinDate,
    availabilityNotes: row.availabilityNotes,
    timezone: row.timezone,
    primaryRecruiterUserId: row.primaryRecruiterUserId,
    referredByEmployeeId: row.referredByEmployeeId,
    employeeId: row.employeeId,
    mergedIntoCandidateId: row.mergedIntoCandidateId,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    archivedAt: row.archivedAt,
    normalizedEmail: row.normalizedEmail,
    normalizedPhone: row.normalizedPhone,

    personal: mapPersonal(row.personal),
    experiences: (row.experiences || []).map(mapExperience),
    educations: (row.educations || []).map(mapEducation),
    skills: (row.skills || []).map(mapSkill),
    projects: (row.projects || []).map(mapProject),
    certifications: (row.certifications || []).map(mapCertification),
    documents: (row.documents || []).map(mapDocument),
    notes: (row.notes || []).map(mapNote),
  };
}

function mapListItem(row: CandidateListRow): CandidateListItem {
  return {
    id: row.id,
    fullName: row.fullName,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    location: row.location,
    currentCompany: row.currentCompany,
    currentTitle: row.currentTitle,
    headline: row.headline ?? null,
    totalExperienceYears: decimalToString(row.totalExperienceYears),
    source: row.source,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    primaryRecruiterUserId: row.primaryRecruiterUserId,
  };
}

function noteRoleLabel(role: string | null | undefined): string | null {
  if (role === "hr") return "HR";
  if (role === "super_admin") return "Super Admin";
  return null;
}

function scopeWhere(scope: RecruitmentScope): Prisma.CandidateWhereInput {
  if (scope.mode === "unrestricted") return {};
  if (scope.candidateIds.length === 0) {
    return { id: { in: [] } };
  }
  return { id: { in: [...scope.candidateIds] } };
}

function filtersWhere(filters?: CandidateListFilters): Prisma.CandidateWhereInput {
  const where: Prisma.CandidateWhereInput = {};
  if (!filters?.includeArchived) {
    where.deletedAt = null;
    where.archivedAt = null;
  }
  if (filters?.status && filters.status !== "all") {
    where.status = filters.status;
  }
  if (filters?.source && filters.source !== "all") {
    where.source = filters.source;
  }
  if (filters?.createdBy) {
    where.createdByUserId = filters.createdBy;
  }
  if (filters?.primaryRecruiter) {
    where.primaryRecruiterUserId = filters.primaryRecruiter;
  }
  if (filters?.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { currentCompany: { contains: q, mode: "insensitive" } },
      { currentTitle: { contains: q, mode: "insensitive" } },
      { normalizedEmail: { contains: q, mode: "insensitive" } },
      { normalizedPhone: { contains: q, mode: "insensitive" } },
    ];
  }
  return where;
}

function mergeWhere(
  scope: RecruitmentScope,
  filters?: CandidateListFilters
): Prisma.CandidateWhereInput {
  return {
    AND: [scopeWhere(scope), filtersWhere(filters)],
  };
}

function orderBy(sort?: CandidateSort): Prisma.CandidateOrderByWithRelationInput {
  const field = sort?.field ?? "createdAt";
  const direction = sort?.direction ?? "desc";
  switch (field) {
    case "fullName":
      return { fullName: direction };
    case "status":
      return { status: direction };
    case "updatedAt":
      return { updatedAt: direction };
    case "createdAt":
    default:
      return { createdAt: direction };
  }
}

export const prismaCandidateRepository: CandidateRepository = {
  async createCandidate(data, tx) {
    const client: Client = tx ?? prisma;

    const experiencesCreate = data.experiences?.map((exp) => ({
      company: exp.company,
      title: exp.title,
      location: exp.location ?? null,
      startDate: exp.startDate ?? null,
      endDate: exp.endDate ?? null,
      isCurrent: exp.isCurrent ?? false,
      description: exp.description ?? null,
      sortOrder: exp.sortOrder ?? 0,
      companyName: exp.companyName ?? exp.company,
      designation: exp.designation ?? exp.title,
      employmentType: exp.employmentType ?? null,
      currentlyWorking: exp.currentlyWorking ?? exp.isCurrent ?? false,
    })) ?? [];

    const educationsCreate = data.educations?.map((edu) => ({
      institution: edu.institution,
      degree: edu.degree ?? null,
      field: edu.field ?? null,
      startYear: edu.startYear ?? null,
      endYear: edu.endYear ?? null,
      notes: edu.notes ?? null,
      sortOrder: edu.sortOrder ?? 0,
      fieldOfStudy: edu.fieldOfStudy ?? edu.field,
      grade: edu.grade ?? null,
    })) ?? [];

    const skillsCreate = data.skills?.map((sk) => ({
      name: sk.name,
      proficiency: sk.proficiency ?? null,
      isConfirmed: sk.isConfirmed ?? true,
      skillName: sk.skillName ?? sk.name,
      yearsOfExperience: sk.yearsOfExperience ?? null,
    })) ?? [];

    const projectsCreate = data.projects?.map((proj) => ({
      title: proj.title,
      summary: proj.summary ?? null,
      techStack: proj.techStack ?? null,
      url: proj.url ?? null,
      sortOrder: proj.sortOrder ?? 0,
      description: proj.description ?? proj.summary,
      technologies: proj.technologies ?? proj.techStack,
      role: proj.role ?? null,
      duration: proj.duration ?? null,
    })) ?? [];

    const certificationsCreate = data.certifications?.map((cert) => ({
      name: cert.name,
      issuer: cert.issuer ?? null,
      issuedAt: cert.issuedAt ?? null,
      expiresAt: cert.expiresAt ?? null,
      credentialId: cert.credentialId ?? null,
      issueDate: cert.issueDate ?? cert.issuedAt ?? null,
      expiryDate: cert.expiryDate ?? cert.expiresAt ?? null,
      credentialUrl: cert.credentialUrl ?? null,
    })) ?? [];

    const documentsCreate = data.documents?.map((doc) => ({
      documentType: doc.documentType,
      fileName: doc.fileName,
      mimeType: doc.mimeType ?? null,
      sizeBytes: doc.sizeBytes ?? null,
      storageKey: doc.storageKey,
      checksum: doc.checksum ?? null,
      version: doc.version ?? 1,
      isPrimary: doc.isPrimary ?? false,
      uploadedByUserId: doc.uploadedByUserId ?? null,
      fileType: doc.fileType ?? null,
      storagePath: doc.storagePath ?? doc.storageKey,
      size: doc.size ?? doc.sizeBytes ?? null,
    })) ?? [];

    const notesCreate = data.notes?.map((note) => ({
      body: note.body,
      visibility: note.visibility ?? "team",
      isPinned: note.isPinned ?? false,
      isResolved: note.isResolved ?? false,
      authorUserId: note.authorUserId,
      content: note.content ?? note.body,
    })) ?? [];

    const created = await client.candidate.create({
      data: {
        tenantId: data.tenantId ?? null,
        fullName: data.fullName,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        preferredName: data.preferredName ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        alternatePhone: data.alternatePhone ?? null,
        dateOfBirth: data.dateOfBirth ?? null,
        location: data.location ?? null,
        currentCompany: data.currentCompany ?? null,
        currentTitle: data.currentTitle ?? null,
        linkedinUrl: data.linkedinUrl ?? null,
        professionalSummary: data.professionalSummary ?? null,
        headline: data.headline ?? null,
        totalExperienceYears: data.totalExperienceYears
          ? new Prisma.Decimal(data.totalExperienceYears)
          : null,
        githubUrl: data.githubUrl ?? null,
        preferredWorkMode: data.preferredWorkMode ?? null,
        willingToRelocate: data.willingToRelocate ?? null,
        source: data.source ?? CandidateSource.manual_upload,
        status: data.status ?? CandidateStatus.active,
        doNotHireReason: data.doNotHireReason ?? null,
        currentCtc: data.currentCtc ? new Prisma.Decimal(data.currentCtc) : null,
        expectedCtc: data.expectedCtc ? new Prisma.Decimal(data.expectedCtc) : null,
        currency: data.currency ?? "INR",
        noticePeriodDays: data.noticePeriodDays ?? null,
        earliestJoinDate: data.earliestJoinDate ?? null,
        availabilityNotes: data.availabilityNotes ?? null,
        timezone: data.timezone ?? null,
        primaryRecruiterUserId: data.primaryRecruiterUserId ?? null,
        referredByEmployeeId: data.referredByEmployeeId ?? null,
        createdByUserId: data.createdByUserId ?? null,
        normalizedEmail: data.normalizedEmail ?? null,
        normalizedPhone: data.normalizedPhone ?? null,

        personal: data.personal
          ? {
              create: {
                nationality: data.personal.nationality ?? null,
                currentLocation: data.personal.currentLocation ?? null,
                preferredLocation: data.personal.preferredLocation ?? null,
                noticePeriod: data.personal.noticePeriod ?? null,
                availabilityDate: data.personal.availabilityDate ?? null,
                linkedinUrl: data.personal.linkedinUrl ?? null,
                portfolioUrl: data.personal.portfolioUrl ?? null,
              },
            }
          : undefined,

        experiences: experiencesCreate.length > 0 ? { create: experiencesCreate } : undefined,
        educations: educationsCreate.length > 0 ? { create: educationsCreate } : undefined,
        skills: skillsCreate.length > 0 ? { create: skillsCreate } : undefined,
        projects: projectsCreate.length > 0 ? { create: projectsCreate } : undefined,
        certifications: certificationsCreate.length > 0 ? { create: certificationsCreate } : undefined,
        documents: documentsCreate.length > 0 ? { create: documentsCreate } : undefined,
        notes: notesCreate.length > 0 ? { create: notesCreate } : undefined,
      },
    });

    return { id: created.id };
  },

  async updateCandidate(id, patch, tx) {
    const client: Client = tx ?? prisma;

    const data: Prisma.CandidateUpdateInput = {};
    if (patch.fullName !== undefined) data.fullName = patch.fullName;
    if (patch.firstName !== undefined) data.firstName = patch.firstName;
    if (patch.lastName !== undefined) data.lastName = patch.lastName;
    if (patch.preferredName !== undefined) data.preferredName = patch.preferredName;
    if (patch.email !== undefined) data.email = patch.email;
    if (patch.phone !== undefined) data.phone = patch.phone;
    if (patch.alternatePhone !== undefined) data.alternatePhone = patch.alternatePhone;
    if (patch.dateOfBirth !== undefined) data.dateOfBirth = patch.dateOfBirth;
    if (patch.location !== undefined) data.location = patch.location;
    if (patch.currentCompany !== undefined) data.currentCompany = patch.currentCompany;
    if (patch.currentTitle !== undefined) data.currentTitle = patch.currentTitle;
    if (patch.linkedinUrl !== undefined) data.linkedinUrl = patch.linkedinUrl;
    if (patch.professionalSummary !== undefined) {
      data.professionalSummary = patch.professionalSummary;
    }
    if (patch.headline !== undefined) data.headline = patch.headline;
    if (patch.totalExperienceYears !== undefined) {
      data.totalExperienceYears = patch.totalExperienceYears
        ? new Prisma.Decimal(patch.totalExperienceYears)
        : null;
    }
    if (patch.githubUrl !== undefined) data.githubUrl = patch.githubUrl;
    if (patch.preferredWorkMode !== undefined) {
      data.preferredWorkMode = patch.preferredWorkMode;
    }
    if (patch.willingToRelocate !== undefined) {
      data.willingToRelocate = patch.willingToRelocate;
    }
    if (patch.source !== undefined) data.source = patch.source;
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.doNotHireReason !== undefined) data.doNotHireReason = patch.doNotHireReason;
    if (patch.currentCtc !== undefined) {
      data.currentCtc = patch.currentCtc ? new Prisma.Decimal(patch.currentCtc) : null;
    }
    if (patch.expectedCtc !== undefined) {
      data.expectedCtc = patch.expectedCtc ? new Prisma.Decimal(patch.expectedCtc) : null;
    }
    if (patch.currency !== undefined) data.currency = patch.currency;
    if (patch.noticePeriodDays !== undefined) data.noticePeriodDays = patch.noticePeriodDays;
    if (patch.earliestJoinDate !== undefined) data.earliestJoinDate = patch.earliestJoinDate;
    if (patch.availabilityNotes !== undefined) data.availabilityNotes = patch.availabilityNotes;
    if (patch.timezone !== undefined) data.timezone = patch.timezone;
    if (patch.primaryRecruiterUserId !== undefined) {
      data.primaryRecruiter = patch.primaryRecruiterUserId
        ? { connect: { id: patch.primaryRecruiterUserId } }
        : { disconnect: true };
    }
    if (patch.referredByEmployeeId !== undefined) {
      data.referredBy = patch.referredByEmployeeId
        ? { connect: { id: patch.referredByEmployeeId } }
        : { disconnect: true };
    }
    if (patch.normalizedEmail !== undefined) data.normalizedEmail = patch.normalizedEmail;
    if (patch.normalizedPhone !== undefined) data.normalizedPhone = patch.normalizedPhone;

    if (patch.personal !== undefined) {
      if (patch.personal) {
        data.personal = {
          upsert: {
            create: {
              nationality: patch.personal.nationality ?? null,
              currentLocation: patch.personal.currentLocation ?? null,
              preferredLocation: patch.personal.preferredLocation ?? null,
              noticePeriod: patch.personal.noticePeriod ?? null,
              availabilityDate: patch.personal.availabilityDate ?? null,
              linkedinUrl: patch.personal.linkedinUrl ?? null,
              portfolioUrl: patch.personal.portfolioUrl ?? null,
            },
            update: {
              nationality: patch.personal.nationality ?? null,
              currentLocation: patch.personal.currentLocation ?? null,
              preferredLocation: patch.personal.preferredLocation ?? null,
              noticePeriod: patch.personal.noticePeriod ?? null,
              availabilityDate: patch.personal.availabilityDate ?? null,
              linkedinUrl: patch.personal.linkedinUrl ?? null,
              portfolioUrl: patch.personal.portfolioUrl ?? null,
            },
          },
        };
      } else {
        data.personal = { delete: true };
      }
    }

    await client.candidate.update({
      where: { id },
      data,
    });
  },

  async softDeleteCandidate(id, tx) {
    const client: Client = tx ?? prisma;
    await client.candidate.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },

  async setStatus(id, status, tx) {
    const client: Client = tx ?? prisma;
    await client.candidate.update({
      where: { id },
      data: { status },
    });
  },

  async getCandidate(id) {
    const row = await prisma.candidate.findFirst({
      where: { id },
      include: detailInclude,
    });
    return row ? mapDetail(row) : null;
  },

  async findByEmail(email) {
    const row = await prisma.candidate.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, deletedAt: null },
      include: detailInclude,
    });
    return row ? mapDetail(row) : null;
  },

  async findByPhone(phone) {
    const row = await prisma.candidate.findFirst({
      where: { phone, deletedAt: null },
      include: detailInclude,
    });
    return row ? mapDetail(row) : null;
  },

  async listCandidates(args) {
    const pagination = normalizePagination(args.pagination);
    const where = mergeWhere(args.scope, args.filters);

    const [total, rows] = await prisma.$transaction([
      prisma.candidate.count({ where }),
      prisma.candidate.findMany({
        where,
        orderBy: orderBy(args.sort),
        skip: paginationSkip(pagination),
        take: pagination.pageSize,
      }),
    ]);

    return toPageResult(rows.map(mapListItem), total, pagination);
  },

  async searchCandidates(args) {
    const pagination = normalizePagination(args.pagination as Partial<PaginationInput>);
    const q = args.query.trim();
    const where: Prisma.CandidateWhereInput = {
      AND: [
        scopeWhere(args.scope),
        {
          deletedAt: null,
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { currentCompany: { contains: q, mode: "insensitive" } },
            { currentTitle: { contains: q, mode: "insensitive" } },
            { normalizedEmail: { contains: q, mode: "insensitive" } },
            { normalizedPhone: { contains: q, mode: "insensitive" } },
          ],
        },
      ],
    };

    const [total, rows] = await prisma.$transaction([
      prisma.candidate.count({ where }),
      prisma.candidate.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: paginationSkip(pagination),
        take: pagination.pageSize,
      }),
    ]);

    return toPageResult(rows.map(mapListItem), total, pagination);
  },

  async countCandidates(scope, filters) {
    const base = mergeWhere(scope, filters);
    const [total, active, talent_pool, hired, archived, merged] = await prisma.$transaction([
      prisma.candidate.count({ where: base }),
      prisma.candidate.count({ where: { AND: [base, { status: CandidateStatus.active }] } }),
      prisma.candidate.count({ where: { AND: [base, { status: CandidateStatus.talent_pool }] } }),
      prisma.candidate.count({ where: { AND: [base, { status: CandidateStatus.hired }] } }),
      prisma.candidate.count({ where: { AND: [base, { status: CandidateStatus.archived }] } }),
      prisma.candidate.count({ where: { AND: [base, { status: CandidateStatus.merged }] } }),
    ]);
    return { total, active, talent_pool, hired, archived, merged };
  },

  async setEmployeeLink(candidateId, employeeId, tx) {
    const client: Client = tx ?? prisma;
    await client.candidate.update({
      where: { id: candidateId },
      data: { employeeId },
    });
  },

  async markMerged(loserId, survivorId, tx) {
    const client: Client = tx ?? prisma;
    await client.candidate.update({
      where: { id: loserId },
      data: {
        mergedIntoCandidateId: survivorId,
        status: CandidateStatus.merged,
        deletedAt: new Date(),
      },
    });
  },

  async upsertExperience(candidateId, data, tx) {
    const client: Client = tx ?? prisma;
    const id = (data.id as string) || undefined;

    const payload = {
      company: data.company as string,
      title: data.title as string,
      location: (data.location as string) ?? null,
      startDate: data.startDate ? new Date(data.startDate as string) : null,
      endDate: data.endDate ? new Date(data.endDate as string) : null,
      isCurrent: (data.isCurrent as boolean) ?? false,
      description: (data.description as string) ?? null,
      sortOrder: (data.sortOrder as number) ?? 0,
      companyName: (data.companyName as string) ?? (data.company as string),
      designation: (data.designation as string) ?? (data.title as string),
      employmentType: (data.employmentType as string) ?? null,
      currentlyWorking: (data.currentlyWorking as boolean) ?? (data.isCurrent as boolean) ?? false,
    };

    if (id) {
      await client.candidateExperience.update({
        where: { id },
        data: payload,
      });
      return { id };
    } else {
      const created = await client.candidateExperience.create({
        data: {
          candidateId,
          ...payload,
        },
      });
      return { id: created.id };
    }
  },

  async upsertEducation(candidateId, data, tx) {
    const client: Client = tx ?? prisma;
    const id = (data.id as string) || undefined;

    const payload = {
      institution: data.institution as string,
      degree: (data.degree as string) ?? null,
      field: (data.field as string) ?? null,
      startYear: (data.startYear as number) ?? null,
      endYear: (data.endYear as number) ?? null,
      notes: (data.notes as string) ?? null,
      sortOrder: (data.sortOrder as number) ?? 0,
      fieldOfStudy: (data.fieldOfStudy as string) ?? (data.field as string),
      grade: (data.grade as string) ?? null,
    };

    if (id) {
      await client.candidateEducation.update({
        where: { id },
        data: payload,
      });
      return { id };
    } else {
      const created = await client.candidateEducation.create({
        data: {
          candidateId,
          ...payload,
        },
      });
      return { id: created.id };
    }
  },

  async upsertSkill(candidateId, data, tx) {
    const client: Client = tx ?? prisma;
    const id = (data.id as string) || undefined;

    const payload = {
      name: data.name as string,
      proficiency: (data.proficiency as string) ?? null,
      isConfirmed: (data.isConfirmed as boolean) ?? true,
      skillName: (data.skillName as string) ?? (data.name as string),
      yearsOfExperience: (data.yearsOfExperience as number) ?? null,
    };

    if (id) {
      await client.candidateSkill.update({
        where: { id },
        data: payload,
      });
      return { id };
    } else {
      const created = await client.candidateSkill.create({
        data: {
          candidateId,
          ...payload,
        },
      });
      return { id: created.id };
    }
  },

  async upsertProject(candidateId, data, tx) {
    const client: Client = tx ?? prisma;
    const id = (data.id as string) || undefined;

    const payload = {
      title: data.title as string,
      summary: (data.summary as string) ?? null,
      techStack: (data.techStack as string) ?? null,
      url: (data.url as string) ?? null,
      sortOrder: (data.sortOrder as number) ?? 0,
      description: (data.description as string) ?? (data.summary as string),
      technologies: (data.technologies as string) ?? (data.techStack as string),
      role: (data.role as string) ?? null,
      duration: (data.duration as string) ?? null,
    };

    if (id) {
      await client.candidateProject.update({
        where: { id },
        data: payload,
      });
      return { id };
    } else {
      const created = await client.candidateProject.create({
        data: {
          candidateId,
          ...payload,
        },
      });
      return { id: created.id };
    }
  },

  async upsertCertification(candidateId, data, tx) {
    const client: Client = tx ?? prisma;
    const id = (data.id as string) || undefined;

    const payload = {
      name: data.name as string,
      issuer: (data.issuer as string) ?? null,
      issuedAt: data.issuedAt ? new Date(data.issuedAt as string) : null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt as string) : null,
      credentialId: (data.credentialId as string) ?? null,
      issueDate: data.issueDate ? new Date(data.issueDate as string) : data.issuedAt ? new Date(data.issuedAt as string) : null,
      expiryDate: data.expiryDate ? new Date(data.expiryDate as string) : data.expiresAt ? new Date(data.expiresAt as string) : null,
      credentialUrl: (data.credentialUrl as string) ?? null,
    };

    if (id) {
      await client.candidateCertification.update({
        where: { id },
        data: payload,
      });
      return { id };
    } else {
      const created = await client.candidateCertification.create({
        data: {
          candidateId,
          ...payload,
        },
      });
      return { id: created.id };
    }
  },

  async replaceSection(candidateId, section, rows, tx) {
    const client: Client = tx ?? prisma;

    if (section === "experiences") {
      await client.candidateExperience.deleteMany({ where: { candidateId } });
      for (const row of rows) {
        await this.upsertExperience(candidateId, row, client);
      }
    } else if (section === "educations") {
      await client.candidateEducation.deleteMany({ where: { candidateId } });
      for (const row of rows) {
        await this.upsertEducation(candidateId, row, client);
      }
    } else if (section === "skills") {
      await client.candidateSkill.deleteMany({ where: { candidateId } });
      for (const row of rows) {
        await this.upsertSkill(candidateId, row, client);
      }
    } else if (section === "projects") {
      await client.candidateProject.deleteMany({ where: { candidateId } });
      for (const row of rows) {
        await this.upsertProject(candidateId, row, client);
      }
    } else if (section === "certifications") {
      await client.candidateCertification.deleteMany({ where: { candidateId } });
      for (const row of rows) {
        await this.upsertCertification(candidateId, row, client);
      }
    }
  },

  async addDocument(candidateId, data, tx) {
    const client: Client = tx ?? prisma;
    const created = await client.candidateDocument.create({
      data: {
        candidateId,
        documentType: data.documentType as RecruitmentDocumentType,
        fileName: data.fileName as string,
        mimeType: (data.mimeType as string) ?? null,
        sizeBytes: (data.sizeBytes as number) ?? null,
        storageKey: data.storageKey as string,
        checksum: (data.checksum as string) ?? null,
        version: (data.version as number) ?? 1,
        isPrimary: (data.isPrimary as boolean) ?? false,
        uploadedByUserId: (data.uploadedByUserId as string) ?? null,
        fileType: (data.fileType as string) ?? null,
        storagePath: (data.storagePath as string) ?? (data.storageKey as string),
        size: (data.size as number) ?? (data.sizeBytes as number) ?? null,
      },
    });
    return { id: created.id };
  },

  async setPrimaryResume(documentId, tx) {
    const client: Client = tx ?? prisma;
    const doc = await client.candidateDocument.findUnique({
      where: { id: documentId },
      select: { candidateId: true },
    });
    if (!doc) return;

    await client.candidateDocument.updateMany({
      where: { candidateId: doc.candidateId, isPrimary: true },
      data: { isPrimary: false },
    });

    await client.candidateDocument.update({
      where: { id: documentId },
      data: { isPrimary: true },
    });
  },

  async softDeleteDocument(documentId, tx) {
    const client: Client = tx ?? prisma;
    await client.candidateDocument.update({
      where: { id: documentId },
      data: { deletedAt: new Date() },
    });
  },

  async getCandidateDocument(documentId) {
    const row = await prisma.candidateDocument.findUnique({
      where: { id: documentId },
    });
    return row ? mapDocument(row) : null;
  },

  async updateCandidateDocument(documentId, patch, tx) {
    const client: Client = tx ?? prisma;
    await client.candidateDocument.update({
      where: { id: documentId },
      data: {
        fileName: patch.fileName,
        documentType: patch.documentType,
        version: patch.version,
        isPrimary: patch.isPrimary,
      },
    });
  },

  async restoreCandidateDocument(documentId, tx) {
    const client: Client = tx ?? prisma;
    await client.candidateDocument.update({
      where: { id: documentId },
      data: { deletedAt: null },
    });
  },

  async listCandidateDocuments(candidateId) {
    const rows = await prisma.candidateDocument.findMany({
      where: { candidateId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapDocument);
  },

  async findDocumentByChecksum(candidateId, checksum) {
    const row = await prisma.candidateDocument.findFirst({
      where: { candidateId, checksum, deletedAt: null },
    });
    return row ? mapDocument(row) : null;
  },

  async setTags(candidateId, tagIds, tx) {
    const client: Client = tx ?? prisma;
    await client.candidateTag.deleteMany({ where: { candidateId } });
    if (tagIds.length > 0) {
      await client.candidateTag.createMany({
        data: tagIds.map((tagId) => ({
          candidateId,
          tagId,
        })),
      });
    }
  },

  async addTalentPoolEntry(candidateId, data, tx) {
    const client: Client = tx ?? prisma;
    const created = await client.talentPoolEntry.create({
      data: {
        candidateId,
        reason: (data.reason as string) ?? null,
        sourceApplicationId: (data.sourceApplicationId as string) ?? null,
        createdByUserId: (data.createdByUserId as string) ?? null,
      },
    });
    return { id: created.id };
  },

  async closeTalentPoolEntry(entryId, tx) {
    const client: Client = tx ?? prisma;
    await client.talentPoolEntry.update({
      where: { id: entryId },
      data: {
        exitedAt: new Date(),
      },
    });
  },

  async createInsight(candidateId, data, tx) {
    const client: Client = tx ?? prisma;
    const created = await client.candidateAiInsight.create({
      data: {
        candidateId,
        insightType: parseEnum(
          data.insightType,
          Object.values(AiInsightType),
          AiInsightType.candidate_summary
        ),
        status: parseEnum(
          data.status,
          Object.values(AiInsightStatus),
          AiInsightStatus.pending_review
        ),
        title: (data.title as string) ?? null,
        contentJson: (data.contentJson as Prisma.InputJsonValue) ?? {},
        confidence: (data.confidence as number) ?? null,
        modelId: (data.modelId as string) ?? null,
        createdByUserId: (data.createdByUserId as string) ?? null,
      },
    });
    return { id: created.id };
  },

  async getInsight(insightId) {
    const row = await prisma.candidateAiInsight.findUnique({
      where: { id: insightId },
    });
    return row;
  },

  async listInsights(candidateId, filters) {
    const insightType = filters?.insightType
      ? parseEnumOptional(filters.insightType, Object.values(AiInsightType))
      : undefined;
    const status = filters?.status
      ? parseEnumOptional(filters.status, Object.values(AiInsightStatus))
      : undefined;

    const rows = await prisma.candidateAiInsight.findMany({
      where: {
        candidateId,
        ...(insightType ? { insightType } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    return rows;
  },

  async updateInsightStatus(insightId, status, tx, meta) {
    const client: Client = tx ?? prisma;
    await client.candidateAiInsight.update({
      where: { id: insightId },
      data: {
        status: parseEnum(status, Object.values(AiInsightStatus), AiInsightStatus.pending_review),
        ...(meta?.reviewedByUserId !== undefined
          ? { reviewedByUserId: meta.reviewedByUserId }
          : {}),
        ...(meta?.reviewedAt !== undefined ? { reviewedAt: meta.reviewedAt } : {}),
      },
    });
  },

  async createIntake(data, tx) {
    const client: Client = tx ?? prisma;
    const created = await client.intakeItem.create({
      data: {
        candidateId: (data.candidateId as string) ?? null,
        jobOpeningId: (data.jobOpeningId as string) ?? null,
        status: parseEnum(
          data.status,
          Object.values(IntakeItemStatus),
          IntakeItemStatus.received
        ),
        source: parseEnum(
          data.source,
          Object.values(CandidateSource),
          CandidateSource.manual_upload
        ),
        rawPayloadJson: (data.rawPayloadJson as Prisma.InputJsonValue) ?? {},
        fileName: (data.fileName as string) ?? null,
        storageKey: (data.storageKey as string) ?? null,
        duplicateOfCandidateId: (data.duplicateOfCandidateId as string) ?? null,
        duplicateConfidence: (data.duplicateConfidence as number) ?? null,
        errorMessage: (data.errorMessage as string) ?? null,
        createdByUserId: (data.createdByUserId as string) ?? null,
      },
    });
    return { id: created.id };
  },

  async updateIntake(intakeId, patch, tx) {
    const client: Client = tx ?? prisma;
    const data: Record<string, unknown> = {};
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.errorMessage !== undefined) data.errorMessage = patch.errorMessage;
    if (patch.candidateId !== undefined) data.candidateId = patch.candidateId;
    if (patch.storageKey !== undefined) data.storageKey = patch.storageKey;
    if (patch.rawPayloadJson !== undefined) {
      data.rawPayloadJson = patch.rawPayloadJson as Prisma.InputJsonValue;
    }
    if (patch.duplicateOfCandidateId !== undefined) {
      data.duplicateOfCandidateId = patch.duplicateOfCandidateId;
    }
    if (Object.keys(data).length === 0) return;
    await client.intakeItem.update({
      where: { id: intakeId },
      data: data as never,
    });
  },

  async findIntake(intakeId) {
    const row = await prisma.intakeItem.findUnique({
      where: { id: intakeId },
    });
    return row;
  },

  async listIntake(args) {
    const pagination = normalizePagination(args.pagination as Partial<PaginationInput>);
    const where: Prisma.IntakeItemWhereInput = {};

    const [total, rows] = await prisma.$transaction([
      prisma.intakeItem.count({ where }),
      prisma.intakeItem.findMany({
        where,
        skip: paginationSkip(pagination),
        take: pagination.pageSize,
      }),
    ]);

    return toPageResult(rows, total, pagination);
  },

  async archiveCandidate(id, tx) {
    const client: Client = tx ?? prisma;
    await client.candidate.update({
      where: { id },
      data: { archivedAt: new Date(), status: CandidateStatus.archived },
    });
  },

  async restoreCandidate(id, tx) {
    const client: Client = tx ?? prisma;
    await client.candidate.update({
      where: { id },
      data: { archivedAt: null, status: CandidateStatus.active },
    });
  },

  async findByNormalizedEmail(email) {
    const row = await prisma.candidate.findFirst({
      where: { normalizedEmail: email, deletedAt: null },
      include: detailInclude,
    });
    return row ? mapDetail(row) : null;
  },

  async findByNormalizedPhone(phone) {
    const row = await prisma.candidate.findFirst({
      where: { normalizedPhone: phone, deletedAt: null },
      include: detailInclude,
    });
    return row ? mapDetail(row) : null;
  },

  async findDuplicateCandidates(email, phone) {
    if (!email && !phone) return [];
    const OR: Prisma.CandidateWhereInput[] = [];
    if (email) OR.push({ normalizedEmail: email });
    if (phone) OR.push({ normalizedPhone: phone });

    const rows = await prisma.candidate.findMany({
      where: { OR, deletedAt: null },
      include: detailInclude,
    });
    return rows.map(mapDetail);
  },

  async addNote(candidateId, data, tx) {
    const client: Client = tx ?? prisma;
    const text = data.body;
    const row = await client.candidateNote.create({
      data: {
        candidateId,
        body: text,
        content: data.content ?? text,
        visibility: data.visibility ?? NoteVisibility.team,
        authorUserId: data.authorUserId,
        isPinned: data.isPinned ?? false,
        isResolved: data.isResolved ?? false,
      },
      include: noteAuthorInclude,
    });
    return mapNote(row);
  },
};
