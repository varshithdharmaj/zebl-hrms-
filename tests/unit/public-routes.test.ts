import { describe, expect, it } from "vitest";
import { isApprovalPublicPath, isPublicPath } from "@/lib/public-routes";

describe("public route guards", () => {
  it("treats approval pages as public", () => {
    expect(isPublicPath("/approve/abc")).toBe(true);
    expect(isApprovalPublicPath("/approve/abc")).toBe(true);
    expect(isApprovalPublicPath("/api/approve/abc")).toBe(true);
  });

  it("does not treat login as approval public", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isApprovalPublicPath("/login")).toBe(false);
  });

  it("keeps admin routes protected", () => {
    expect(isPublicPath("/admin/employees")).toBe(false);
    expect(isApprovalPublicPath("/manager/dashboard")).toBe(false);
  });
});
