import { SavedFilterEntity } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { RecruitmentReportFilters, ReportSectionKey, SavedReportPreset } from "./types";
import { toReportFilters } from "./parse-filters";

type PresetJson = {
  section: ReportSectionKey;
  filters: Record<string, unknown>;
};

function asPresetJson(value: unknown): PresetJson | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.section !== "string") return null;
  return {
    section: row.section as ReportSectionKey,
    filters:
      typeof row.filters === "object" && row.filters !== null
        ? (row.filters as Record<string, unknown>)
        : {},
  };
}

export async function listReportPresets(
  userId: string,
  section?: ReportSectionKey
): Promise<SavedReportPreset[]> {
  const rows = await prisma.recruitmentSavedFilter.findMany({
    where: {
      userId,
      entity: SavedFilterEntity.reports,
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  return rows
    .map((row) => {
      const payload = asPresetJson(row.filterJson);
      if (!payload) return null;
      if (section && payload.section !== section) return null;
      return {
        id: row.id,
        name: row.name,
        section: payload.section,
        filters: toReportFilters(payload.filters as Record<string, string>),
        isDefault: row.isDefault,
      };
    })
    .filter((row): row is SavedReportPreset => row !== null);
}

export async function saveReportPreset(input: {
  userId: string;
  name: string;
  section: ReportSectionKey;
  filters: RecruitmentReportFilters;
  isDefault?: boolean;
}): Promise<{ id: string }> {
  if (input.isDefault) {
    await prisma.recruitmentSavedFilter.updateMany({
      where: {
        userId: input.userId,
        entity: SavedFilterEntity.reports,
        isDefault: true,
      },
      data: { isDefault: false },
    });
  }

  const filterJson = {
    section: input.section,
    filters: {
      startDate: input.filters.dateRange?.startDate?.toISOString().slice(0, 10),
      endDate: input.filters.dateRange?.endDate?.toISOString().slice(0, 10),
      department: input.filters.department,
      recruiterUserId: input.filters.recruiterUserId,
      jobOpeningId: input.filters.jobOpeningId,
      location: input.filters.location,
      employmentType: input.filters.employmentType,
      status: input.filters.status,
      search: input.filters.search,
      days: input.filters.days,
    },
  };

  const existing = await prisma.recruitmentSavedFilter.findUnique({
    where: {
      userId_entity_name: {
        userId: input.userId,
        entity: SavedFilterEntity.reports,
        name: input.name,
      },
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.recruitmentSavedFilter.update({
      where: { id: existing.id },
      data: {
        filterJson,
        isDefault: input.isDefault ?? false,
      },
    });
    return { id: existing.id };
  }

  const created = await prisma.recruitmentSavedFilter.create({
    data: {
      userId: input.userId,
      entity: SavedFilterEntity.reports,
      name: input.name,
      filterJson,
      isDefault: input.isDefault ?? false,
    },
    select: { id: true },
  });
  return created;
}

export async function deleteReportPreset(
  userId: string,
  id: string
): Promise<void> {
  await prisma.recruitmentSavedFilter.deleteMany({
    where: {
      id,
      userId,
      entity: SavedFilterEntity.reports,
    },
  });
}
