import { z } from "zod";

export const convertEmployeeSchema = z.object({
  offerId: z.string().trim().min(1, "Offer ID is required."),
  employeeCode: z.string().trim().min(1, "Employee code is required."),
  name: z.string().trim().min(1, "Name is required."),
  email: z.string().trim().email("Invalid email address.").optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  department: z.string().trim().min(1, "Department is required."),
  designation: z.string().trim().min(1, "Designation is required."),
  managerId: z.coerce.number().int().positive().optional().nullable(),
  employmentType: z.string().trim().min(1, "Employment type is required."),
  workLocation: z.string().trim().min(1, "Location is required."),
  joiningDate: z.string().trim().min(1, "Joining date is required."),
  grade: z.string().trim().min(1, "Grade is required."),
  ctc: z.coerce.number().positive("CTC must be positive."),
  createLogin: z.boolean().optional().default(false),
  password: z.string().optional().nullable(),
});

export const employeeAccountSchema = z.object({
  email: z.string().trim().email("Invalid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});
