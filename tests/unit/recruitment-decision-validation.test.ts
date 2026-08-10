import { describe, expect, it } from "vitest";
import { HiringDecisionOutcome } from "@/generated/prisma/enums";
import { submitHiringDecisionSchema } from "@/lib/validation/schemas/recruitment/decisions";

const valid = {
  applicationId: "app-1",
  outcome: HiringDecisionOutcome.hire,
  rationale: "Strong panel consensus and role fit.",
  strengths: "Clear ownership and communication.",
};

describe("submitHiringDecisionSchema", () => {
  it("accepts a valid decision", () => {
    const parsed = submitHiringDecisionSchema.parse(valid);
    expect(parsed.outcome).toBe(HiringDecisionOutcome.hire);
    expect(parsed.rationale).toBe(valid.rationale);
    expect(parsed.concerns).toBeNull();
  });

  it("rejects missing rationale", () => {
    const result = submitHiringDecisionSchema.safeParse({ ...valid, rationale: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects missing strengths", () => {
    const result = submitHiringDecisionSchema.safeParse({ ...valid, strengths: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid outcome", () => {
    const result = submitHiringDecisionSchema.safeParse({ ...valid, outcome: "maybe" });
    expect(result.success).toBe(false);
  });

  it("allows optional concerns", () => {
    const parsed = submitHiringDecisionSchema.parse({
      ...valid,
      concerns: "Compensation sensitivity.",
    });
    expect(parsed.concerns).toBe("Compensation sensitivity.");
  });
});
