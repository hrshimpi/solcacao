// The checks for reading and changing quote requests: the list in the address, the id, and the status change an
// admin sends. Written like the other schemas, with messages a person can read.
// The quote amount is in whole cents, so 125000 is 1,250.00.
import { z } from "zod";
import { requestStatuses } from "../models/b2b-request.model.ts";
import { pageFields } from "./pagination.ts";
import { text } from "./plain-text.ts";

const MAX_CENTS = 10_000_000_000;

export const requestListQuerySchema = z.object({ ...pageFields });

export const requestIdSchema = z.string().regex(/^[0-9a-f]{24}$/i, "That isn't a valid request id.");

const quoteAmountMessage = "quoteAmount must be a whole number of cents.";
const quoteAmount = z
  .number({ error: quoteAmountMessage })
  .int(quoteAmountMessage)
  .min(1, "quoteAmount must be at least 1 cent.")
  .max(MAX_CENTS, `quoteAmount can be at most ${MAX_CENTS} cents.`);

// the note is plain text, and an empty one counts as none
const quoteNote = text("quoteNote must be text.")
  .pipe(z.string().max(2000, "quoteNote can be at most 2000 characters."))
  .transform((value) => (value === "" ? undefined : value))
  .optional();

export const statusChangeSchema = z
  .object({
    status: z.enum(requestStatuses, { error: `status must be one of: ${requestStatuses.join(", ")}.` }),
    quoteAmount: quoteAmount.optional(),
    quoteNote,
  })
  .superRefine((change, context) => {
    // the price is set once, when the request is quoted. After that it is what the customer answered to.
    if (change.status === "quoted" && change.quoteAmount === undefined) {
      context.addIssue({ code: "custom", path: ["quoteAmount"], message: "A quoted request needs a quoteAmount, in cents." });
    }
    if (change.status !== "quoted" && change.quoteAmount !== undefined) {
      context.addIssue({ code: "custom", path: ["quoteAmount"], message: "The quoteAmount can only be set when the status is quoted." });
    }
  });

export type RequestListQueryInput = z.output<typeof requestListQuerySchema>;
export type StatusChangeInput = z.output<typeof statusChangeSchema>;
