import { describe, expect, it } from "vitest";
import {
  accountIdentityUpdateSchema,
  employeeProfileUpdateSchema,
  passwordResetSchema,
} from "@/lib/validation/schemas/employee-account";

describe("employee account validation", () => {
  it("rejects mismatched manual reset passwords", () => {
    const result = passwordResetSchema.safeParse({
      userId: "user-1",
      mode: "manual",
      password: "Password123",
      confirmPassword: "Password456",
      mustChangePassword: true,
    });
    expect(result.success).toBe(false);
  });

  it("accepts generated password mode without receiving a password", () => {
    const result = passwordResetSchema.safeParse({
      userId: "user-1",
      mode: "generated",
      mustChangePassword: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects malformed usernames and duplicate-prone invalid emails", () => {
    expect(
      accountIdentityUpdateSchema.safeParse({
        userId: "user-1",
        username: "invalid username",
        email: "not-an-email",
        profilePhotoUrl: "",
      }).success
    ).toBe(false);
  });

  it("validates the expanded employee profile fields", () => {
    const result = employeeProfileUpdateSchema.safeParse({
      id: "12",
      firstName: "John",
      lastName: "Doe",
      preferredName: "",
      name: "John Doe",
      gender: "Male",
      dateOfBirth: "1990-01-01",
      email: "john@example.com",
      phone: "555-0100",
      alternatePhone: "",
      address: "Example Street",
      emergencyContact: "Jane — 555-0101",
      department: "Operations",
      designation: "Analyst",
      employmentType: "Full-time",
      workLocation: "Bengaluru",
      shift: "Morning Shift",
      joiningDate: "2025-01-01",
      employeeStatus: "Active",
      managerId: "none",
    });
    expect(result.success).toBe(true);
  });
});
