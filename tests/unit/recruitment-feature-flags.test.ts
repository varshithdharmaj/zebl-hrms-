import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  isRecruitmentConversionEnabled,
  isRecruitmentModuleEnabled,
  isRecruitmentOffersEnabled,
  recruitmentFeatureFlags,
} from "@/lib/recruitment/config/feature-flags";

describe("recruitment feature flags", () => {
  const keys = [
    "RECRUITMENT_MODULE_ENABLED",
    "RECRUITMENT_OFFERS_ENABLED",
    "RECRUITMENT_CONVERSION_ENABLED",
  ] as const;
  const originals = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of keys) {
      originals.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of keys) {
      const value = originals.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("defaults module off; offers/conversion follow module", () => {
    expect(isRecruitmentModuleEnabled()).toBe(false);
    expect(isRecruitmentOffersEnabled()).toBe(false);
    expect(isRecruitmentConversionEnabled()).toBe(false);
    expect(recruitmentFeatureFlags.moduleEnabled).toBe(false);
  });

  it("enables module for true/1/yes/on", () => {
    for (const value of ["true", "TRUE", "1", "yes", "on"]) {
      process.env.RECRUITMENT_MODULE_ENABLED = value;
      expect(isRecruitmentModuleEnabled()).toBe(true);
    }
  });

  it("defaults offers/conversion ON when module enabled and sub-flags unset", () => {
    process.env.RECRUITMENT_MODULE_ENABLED = "true";
    expect(isRecruitmentOffersEnabled()).toBe(true);
    expect(isRecruitmentConversionEnabled()).toBe(true);
  });

  it("keeps offers/conversion off when module disabled even if sub-flags true", () => {
    process.env.RECRUITMENT_OFFERS_ENABLED = "true";
    process.env.RECRUITMENT_CONVERSION_ENABLED = "true";
    expect(isRecruitmentOffersEnabled()).toBe(false);
    expect(isRecruitmentConversionEnabled()).toBe(false);
  });

  it("honors explicit false for offers/conversion when module on", () => {
    process.env.RECRUITMENT_MODULE_ENABLED = "true";
    process.env.RECRUITMENT_OFFERS_ENABLED = "false";
    process.env.RECRUITMENT_CONVERSION_ENABLED = "false";
    expect(isRecruitmentOffersEnabled()).toBe(false);
    expect(isRecruitmentConversionEnabled()).toBe(false);
  });
});
