"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/actions/types";
import { requireRecruitmentAdminSession } from "@/lib/auth-guards";
import { safeParseWithSchema } from "@/lib/validation/parse";
import {
  createPipelineStageSchema,
  updatePipelineStageSchema,
  movePipelineStageSchema,
  archivePipelineStageSchema,
} from "@/lib/validation/schemas/recruitment/pipeline-stages";
import { PipelineStageService } from "@/lib/recruitment/job/pipeline-stage-service";
import { mapUnknownToActionState } from "@/lib/recruitment/shared/result";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";

export type RecruitmentJobStageActionState = ActionState & {
  stageId?: string;
};

function revalidatePipeline(jobOpeningId?: string) {
  revalidatePath("/admin/recruitment/pipeline");
  if (jobOpeningId) {
    revalidatePath(`/admin/recruitment/jobs/${jobOpeningId}`);
  }
}

export async function addPipelineStageAction(
  _prev: RecruitmentJobStageActionState,
  input: unknown
): Promise<RecruitmentJobStageActionState> {
  try {
    const parsed = safeParseWithSchema(createPipelineStageSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireRecruitmentAdminSession();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const { id } = await PipelineStageService.createStage(session, parsed.data);

    revalidatePipeline(parsed.data.jobOpeningId);
    return { success: "Stage added.", stageId: id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function renamePipelineStageAction(
  _prev: RecruitmentJobStageActionState,
  input: unknown
): Promise<RecruitmentJobStageActionState> {
  try {
    const parsed = safeParseWithSchema(updatePipelineStageSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireRecruitmentAdminSession();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    await PipelineStageService.updateStage(session, parsed.data);

    revalidatePipeline();
    return { success: "Stage updated.", stageId: parsed.data.stageId };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function movePipelineStageAction(
  _prev: RecruitmentJobStageActionState,
  input: unknown
): Promise<RecruitmentJobStageActionState> {
  try {
    const parsed = safeParseWithSchema(movePipelineStageSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireRecruitmentAdminSession();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    await PipelineStageService.moveStage(session, parsed.data);

    revalidatePipeline();
    return { success: "Stage moved.", stageId: parsed.data.stageId };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function archivePipelineStageAction(
  _prev: RecruitmentJobStageActionState,
  input: unknown
): Promise<RecruitmentJobStageActionState> {
  try {
    const parsed = safeParseWithSchema(archivePipelineStageSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireRecruitmentAdminSession();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    await PipelineStageService.archiveStage(session, parsed.data);

    revalidatePipeline();
    return { success: "Stage archived.", stageId: parsed.data.stageId };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}
