// The checks for the admin side of inquiries: the list filters, the id in the address and the status change.
// Written like the inquiry form schema, with messages a person can read.
import { z } from "zod";
import { inquiryCategories, inquiryStatuses } from "../models/inquiry.model.ts";
import { pageFields } from "./pagination.ts";

const statusMessage = "Status must be new or responded.";

export const inquiryListQuerySchema = z.object({
  ...pageFields,
  status: z.enum(inquiryStatuses, { error: statusMessage }).optional(),
  category: z.enum(inquiryCategories, { error: `category must be one of: ${inquiryCategories.join(", ")}.` }).optional(),
});

export const inquiryIdSchema = z.string().regex(/^[0-9a-f]{24}$/i, "That isn't a valid inquiry id.");

export const inquiryStatusBodySchema = z.object({
  status: z.enum(inquiryStatuses, { error: statusMessage }),
});

export type InquiryListQueryInput = z.output<typeof inquiryListQuerySchema>;
