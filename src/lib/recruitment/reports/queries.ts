import { cache } from "react";
import type { SessionUser } from "@/lib/session";
import { buildReportBundle } from "./build-report-bundle";
import { listReportPresets } from "./saved-filters";
import type { ReportSectionKey, RecruitmentReportFilters } from "./types";

export const getReportBundleCached = cache(
  async (
    session: SessionUser,
    section: ReportSectionKey,
    filters: RecruitmentReportFilters
  ) => buildReportBundle(session, section, filters)
);

export const listReportPresetsCached = cache(
  async (session: SessionUser, section?: ReportSectionKey) =>
    listReportPresets(session.id, section)
);
