// The checks for the admin side of inquiries: the list filters, the id in the address and the status change.
// Written like the inquiry form schema, with messages a person can read.
import { z } from "zod";
import { inquiryCategories, inquiryStatuses } from "../models/inquiry.model.ts";

const statusMessage = "Status must be new or responded.";

export const inquiryListQuerySchema = z.object({
  page: z.coerce.number({ error: "page must be a number." }).int("page must be a whole number.").min(1, "page starts at 1.").default(1),
  limit: z.coerce
    .number({ error: "limit must be a number." })
    .int("limit must be a whole number.")
    .min(1, "limit must be at least 1.")
    .max(100, "limit can be at most 100.")
    .default(20),
  status: z.enum(inquiryStatuses, { error: statusMessage }).optional(),
  category: z.enum(inquiryCategories, { error: `category must be one of: ${inquiryCategories.join(", ")}.` }).optional(),
});

export const inquiryIdSchema = z.string().regex(/^[0-9a-f]{24}$/i, "That isn't a valid inquiry id.");

export const inquiryStatusBodySchema = z.object({
  status: z.enum(inquiryStatuses, { error: statusMessage }),
});

export type InquiryListQueryInput = z.output<typeof inquiryListQuerySchema>;
