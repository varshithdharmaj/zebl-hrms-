import { z } from "zod";

export const bulkLeaveItemSchema = z.object({
  leaveId: z.number().int().positive(),
  version: z.number().int().nonnegative(),
});

export const bulkLeaveItemsSchema = z
  .array(bulkLeaveItemSchema)
  .min(1, "No items selected.")
  .max(25, "Maximum 25 items per batch.");

export const bulkRejectCommentSchema = z
  .string()
  .trim()
  .min(1, "Rejection comment is required.");
