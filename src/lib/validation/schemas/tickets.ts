import { z } from "zod";

export const ticketCategorySchema = z.enum([
  "attendance",
  "leave",
  "payroll",
  "salary",
  "it_technical",
  "hr",
  "workplace",
  "facilities",
  "suggestion",
  "other",
]);

export const ticketTypeSchema = z.enum([
  "complaint",
  "service_request",
  "suggestion",
  "meeting_request",
  "anonymous_complaint",
  "other",
]);

export const ticketPrioritySchema = z.enum(["low", "medium", "high"]);

export const createTicketSchema = z.object({
  subject: z.string().min(3, "Subject must be at least 3 characters").max(200, "Subject too long"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(5000, "Description too long"),
  category: ticketCategorySchema,
  type: ticketTypeSchema,
  priority: ticketPrioritySchema,
  isAnonymous: z.boolean().default(false),
});

export const ticketReplySchema = z.object({
  ticketId: z.string().min(1),
  body: z.string().min(1, "Reply cannot be empty").max(5000, "Reply too long"),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type TicketReplyInput = z.infer<typeof ticketReplySchema>;
