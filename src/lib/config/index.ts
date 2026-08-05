export {
  getEnv,
  requireEnv,
  isProduction,
  isPostgresDatabase,
} from "@/lib/config/env";
export {
  isAttendanceImportPreviewEnabled,
  attendanceImportConfig,
} from "@/lib/config/attendance-import";
export {
  isRecruitmentModuleEnabled,
  isRecruitmentOffersEnabled,
  isRecruitmentConversionEnabled,
  recruitmentFeatureFlags,
} from "@/lib/recruitment/config/feature-flags";
export {
  validateApplicationConfig,
  assertValidConfig,
  type ConfigIssue,
  type ConfigValidationResult,
} from "@/lib/config/validate";
export {
  validateDatabaseUrl,
  assertDatabaseUrl,
  probeDatabaseConnection,
} from "@/lib/config/database";
