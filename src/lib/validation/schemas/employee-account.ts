import { AccountStatus } from "@prisma/client";
import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => value || null);

const optionalEmail = z
  .union([z.string().trim().email("Enter a valid email address."), z.literal("")])
  .transform((value) => value || null);

export const employeeProfileUpdateSchema = z.object({
  id: z.coerce.number().int().positive(),
  firstName: optionalText(100),
  lastName: optionalText(100),
  preferredName: optionalText(100),
  name: z.string().trim().min(1, "Full name is required.").max(200),
  gender: optionalText(50),
  dateOfBirth: z.union([z.coerce.date(), z.literal("")]).optional().transform((value) =>
    value === "" || value === undefined ? null : value
  ),
  email: optionalEmail,
  phone: optionalText(50),
  alternatePhone: optionalText(50),
  address: optionalText(500),
  emergencyContact: optionalText(250),
  department: optionalText(150),
  designation: optionalText(150),
  employmentType: optionalText(100),
  workLocation: optionalText(150),
  shift: optionalText(100),
  joiningDate: z.coerce.date(),
  employeeStatus: z.enum(["Active", "Inactive", "Resigned", "Terminated"]),
  managerId: z.union([z.coerce.number().int().positive(), z.literal(""), z.literal("none")])
    .transform((value) => value === "" || value === "none" ? null : value),
});

export const passwordResetSchema = z
  .object({
    userId: z.string().min(1),
    mode: z.enum(["manual", "generated"]),
    password: z.string().optional().default(""),
    confirmPassword: z.string().optional().default(""),
    mustChangePassword: z.coerce.boolean().default(false),
  })
  .superRefine((value, context) => {
    if (value.mode !== "manual") return;
    if (value.password.length < 8) {
      context.addIssue({
        code: "custom",
        path: ["password"],
        message: "Password must be at least 8 characters.",
      });
    }
    if (value.password !== value.confirmPassword) {
      context.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match.",
      });
    }
  });

export const accountStatusUpdateSchema = z.object({
  userId: z.string().min(1),
  status: z.nativeEnum(AccountStatus),
  reason: z.string().trim().max(500).optional().default(""),
});

export const accountIdentityUpdateSchema = z.object({
  userId: z.string().min(1),
  username: z.union([
    z.string().trim().min(3).max(100).regex(/^[a-zA-Z0-9._-]+$/, "Username contains invalid characters."),
    z.literal(""),
  ]),
  email: z.string().trim().email(),
  profilePhotoUrl: z.union([z.string().trim().url(), z.literal("")]),
});
