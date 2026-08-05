import { beforeEach, describe, expect, it, vi } from "vitest";
import { convertEmployeeAction, previewConversionAction } from "@/actions/recruitment-conversions";
import { createEmployeeConversionService } from "@/lib/recruitment/services/employee-conversion-service";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth-guards", () => ({
  requireHROrSuperAdminSession: async () => ({
    id: "user-hr",
    email: "hr@example.com",
    role: "hr",
    employeeId: 1,
  }),
}));

vi.mock("@/lib/recruitment/config/feature-flags", () => ({
  isRecruitmentModuleEnabled: () => true,
  isRecruitmentOffersEnabled: () => true,
  isRecruitmentConversionEnabled: () => true,
}));

vi.mock("@/lib/recruitment/services/employee-conversion-service", () => ({
  createEmployeeConversionService: vi.fn(() => ({
    convertEmployee: vi.fn(async () => ({ employeeId: 101 })),
    previewConversion: vi.fn(async () => ({
      candidate: { fullName: "John Doe" },
      offer: { id: "off-1" },
      checklist: {},
      blockingErrors: [],
    })),
  })),
}));

describe("Recruitment Conversion Actions", () => {
  it("convertEmployeeAction runs successfully with valid input", async () => {
    const result = await convertEmployeeAction({}, {
      offerId: "off-1",
      employeeCode: "EMP-1024",
      name: "John Doe",
      email: "john.doe@example.com",
      phone: "1234567890",
      department: "Engineering",
      designation: "Software Engineer",
      managerId: 10,
      employmentType: "Full-time",
      workLocation: "Bangalore",
      joiningDate: "2026-09-01",
      grade: "L1",
      ctc: 1200000,
      createLogin: true,
      password: "password123",
    });

    expect(result.success).toBeDefined();
    expect(result.employeeId).toBe(101);
  });

  it("convertEmployeeAction returns validation errors for invalid input", async () => {
    const result = await convertEmployeeAction({}, {
      offerId: "", // Invalid
      employeeCode: "",
      name: "",
    });

    expect(result.error).toBeDefined();
    expect(result.success).toBeUndefined();
  });

  it("previewConversionAction runs successfully", async () => {
    const result = await previewConversionAction("off-1");
    expect(result.candidate.fullName).toBe("John Doe");
  });
});
