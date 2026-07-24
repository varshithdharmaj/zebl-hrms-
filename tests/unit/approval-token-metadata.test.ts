import { describe, expect, it } from "vitest";
import {
  buildApprovalTokenMetadata,
  resolveTokenExpectedVersion,
} from "@/lib/approval-tokens/token-types";

describe("approval token leaveVersion snapshot", () => {
  it("stores an integer leaveVersion in metadata", () => {
    expect(JSON.parse(buildApprovalTokenMetadata(3))).toEqual({ leaveVersion: 3 });
  });

  it("prefers the issued snapshot over the live leave version", () => {
    expect(resolveTokenExpectedVersion(buildApprovalTokenMetadata(2), 9)).toBe(2);
  });

  it("falls back to the live leave version for legacy empty metadata", () => {
    expect(resolveTokenExpectedVersion("{}", 4)).toBe(4);
    expect(resolveTokenExpectedVersion("not-json", 5)).toBe(5);
  });

  it("ignores non-integer leaveVersion values", () => {
    expect(resolveTokenExpectedVersion(JSON.stringify({ leaveVersion: 1.5 }), 7)).toBe(7);
    expect(resolveTokenExpectedVersion(JSON.stringify({ leaveVersion: "0" }), 8)).toBe(8);
  });
});
