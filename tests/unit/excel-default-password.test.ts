import { describe, expect, it } from "vitest";
import { EXCEL_UPLOAD_DEFAULT_PASSWORD } from "@/lib/admin/account-lifecycle";

describe("excel auto-provision password", () => {
  it("keeps the business default password 123", () => {
    expect(EXCEL_UPLOAD_DEFAULT_PASSWORD).toBe("123");
  });
});
