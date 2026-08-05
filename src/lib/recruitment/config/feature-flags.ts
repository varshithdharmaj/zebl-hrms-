import { getEnv } from "@/lib/config/env";

/**
 * Recruitment module feature flags.
 * Default: module disabled — nav and routes must not be reachable.
 *
 * Set RECRUITMENT_MODULE_ENABLED=true to enable Phase 1 shell.
 */
export function isRecruitmentModuleEnabled(): boolean {
  const raw = getEnv("RECRUITMENT_MODULE_ENABLED");
  if (!raw) return false;
  const normalized = raw.toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

/**
 * Offers sub-flag. When unset, defaults ON if the module is enabled
 * (backward compatible with shipped offers UI). Set to false to disable.
 */
export function isRecruitmentOffersEnabled(): boolean {
  if (!isRecruitmentModuleEnabled()) return false;
  const raw = getEnv("RECRUITMENT_OFFERS_ENABLED");
  if (!raw) return true;
  const normalized = raw.toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

/**
 * Conversion sub-flag. When unset, defaults ON if the module is enabled.
 * Set to false to disable.
 */
export function isRecruitmentConversionEnabled(): boolean {
  if (!isRecruitmentModuleEnabled()) return false;
  const raw = getEnv("RECRUITMENT_CONVERSION_ENABLED");
  if (!raw) return true;
  const normalized = raw.toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export const recruitmentFeatureFlags = {
  get moduleEnabled(): boolean {
    return isRecruitmentModuleEnabled();
  },
  get offersEnabled(): boolean {
    return isRecruitmentOffersEnabled();
  },
  get conversionEnabled(): boolean {
    return isRecruitmentConversionEnabled();
  },
} as const;
