import { describe, expect, it } from "vitest";
import {
  buildSubmissionToken,
  parseSubmissionToken,
  verifySubmissionTokenSignature,
} from "@/lib/recruitment/public-apply/token-service";

describe("public-apply token service", () => {
  it("round-trips a valid token", () => {
    const token = buildSubmissionToken("sub-123");
    const verified = verifySubmissionTokenSignature(token);
    expect(verified).toEqual({ submissionId: "sub-123" });
  });

  it("rejects a tampered signature", () => {
    const token = buildSubmissionToken("sub-123");
    const [id] = token.split(".");
    const tampered = `${id}.not-the-real-signature`;
    expect(verifySubmissionTokenSignature(tampered)).toBeNull();
  });

  it("rejects a token issued for a different submission id (id swap)", () => {
    const tokenA = buildSubmissionToken("sub-a");
    const tokenB = buildSubmissionToken("sub-b");
    const [, sigA] = tokenA.split(".");
    const [idB] = tokenB.split(".");
    const swapped = `${idB}.${sigA}`;
    expect(verifySubmissionTokenSignature(swapped)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(verifySubmissionTokenSignature("")).toBeNull();
    expect(verifySubmissionTokenSignature("no-dot-here")).toBeNull();
    expect(verifySubmissionTokenSignature(".leading-dot")).toBeNull();
    expect(verifySubmissionTokenSignature("trailing-dot.")).toBeNull();
  });

  it("parseSubmissionToken splits on the last dot only", () => {
    const parsed = parseSubmissionToken("abc.def.ghi");
    expect(parsed).toEqual({ submissionId: "abc.def", signature: "ghi" });
  });
});
