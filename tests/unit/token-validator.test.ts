import { describe, expect, it } from "vitest";
import { ApprovalTokenAction } from "@prisma/client";
import {
  parseSignedToken,
  verifyTokenSignature,
} from "@/lib/approval-tokens/token-validator";
import { signToken } from "@/lib/approval-tokens/token-generator";

describe("approval token crypto", () => {
  it("parses signed token format", () => {
    const signed = signToken("token-id-123", ApprovalTokenAction.approve);
    const parsed = parseSignedToken(signed);
    expect(parsed?.id).toBe("token-id-123");
    expect(parsed?.signature).toBeTruthy();
  });

  it("rejects tampered signatures", () => {
    const signed = signToken("token-id-456", ApprovalTokenAction.reject);
    const parsed = parseSignedToken(signed);
    expect(parsed).not.toBeNull();
    expect(
      verifyTokenSignature(parsed!.id, ApprovalTokenAction.approve, parsed!.signature)
    ).toBe(false);
  });

  it("accepts valid signatures", () => {
    const id = "token-id-789";
    const signed = signToken(id, ApprovalTokenAction.approve);
    const parsed = parseSignedToken(signed);
    expect(
      verifyTokenSignature(parsed!.id, ApprovalTokenAction.approve, parsed!.signature)
    ).toBe(true);
  });
});
