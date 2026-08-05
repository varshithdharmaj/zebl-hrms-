"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/actions/types";
import { mapUnknownToActionState } from "@/lib/recruitment/shared/result";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";
import { safeParseWithSchema } from "@/lib/validation/parse";
import {
  deleteReportPresetSchema,
  exportReportSchema,
  saveReportPresetSchema,
} from "@/lib/recruitment/reports/filter-schema";
import { requireRecruitmentReportSession } from "@/lib/recruitment/reports/auth";
import { buildReportBundle } from "@/lib/recruitment/reports/build-report-bundle";
import { buildReportExport } from "@/lib/recruitment/reports/export";
import { toReportFilters } from "@/lib/recruitment/reports/parse-filters";
import {
  deleteReportPreset,
  saveReportPreset,
} from "@/lib/recruitment/reports/saved-filters";

export type RecruitmentReportActionState = ActionState & {
  presetId?: string;
  download?: {
    filename: string;
    mimeType: string;
    base64: string;
  };
};

function revalidateReports(section?: string) {
  revalidatePath("/admin/recruitment/reports");
  if (section) {
    revalidatePath(`/admin/recruitment/reports/${section}`);
  }
}

export async function saveReportPresetAction(
  _prev: RecruitmentReportActionState,
  input: unknown
): Promise<RecruitmentReportActionState> {
  try {
    const parsed = safeParseWithSchema(saveReportPresetSchema, input);
    if (!parsed.ok) return { error: parsed.error };
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }
    const session = await requireRecruitmentReportSession();
    const filters = toReportFilters(parsed.data.filters);
    const { id } = await saveReportPreset({
      userId: session.id,
      name: parsed.data.name,
      section: parsed.data.section,
      filters,
      isDefault: parsed.data.isDefault,
    });
    revalidateReports(parsed.data.section);
    return { success: "Filter preset saved.", presetId: id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function deleteReportPresetAction(
  _prev: RecruitmentReportActionState,
  input: unknown
): Promise<RecruitmentReportActionState> {
  try {
    const parsed = safeParseWithSchema(deleteReportPresetSchema, input);
    if (!parsed.ok) return { error: parsed.error };
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }
    const session = await requireRecruitmentReportSession();
    await deleteReportPreset(session.id, parsed.data.id);
    revalidateReports();
    return { success: "Filter preset deleted." };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function exportRecruitmentReportAction(
  input: unknown
): Promise<RecruitmentReportActionState> {
  try {
    const parsed = safeParseWithSchema(exportReportSchema, input);
    if (!parsed.ok) return { error: parsed.error };
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }
    const session = await requireRecruitmentReportSession();
    const filters = toReportFilters(parsed.data.filters);
    const bundle = await buildReportBundle(
      session,
      parsed.data.section,
      filters
    );
    const exported = buildReportExport(bundle, parsed.data.format, {
      tableId: parsed.data.tableId,
      selectedRowIds: parsed.data.selectedRowIds,
    });
    const base64 =
      typeof exported.data === "string"
        ? Buffer.from(exported.data, "utf8").toString("base64")
        : exported.data.toString("base64");

    return {
      success: "Export ready.",
      download: {
        filename: exported.filename,
        mimeType: exported.mimeType,
        base64,
      },
    };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}
