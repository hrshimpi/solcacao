// The zod schema for a quote request from the Corporate Cacao Studio. The text fields of a multipart form all
// arrive as text, so numbers are read from text. Text is stripped of HTML like in the inquiry form, and the
// messages are written for the person filling in the form. Anything that is not listed here (a status, a quote
// amount, a user id) is dropped, so a form can never set it.
import { z } from "zod";
import { packagingTypes } from "../models/b2b-request.model.ts";
import { text } from "./plain-text.ts";

const MAX_UNITS = 10_000_000;

const cacaoProfile = text("Please choose a cacao profile.").pipe(
  z
    .string()
    .min(1, { error: "Please choose a cacao profile.", abort: true })
    .max(60, "The cacao profile can be at most 60 characters."),
);

const packagingType = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.enum(packagingTypes, { error: "Please choose a packaging option: foil_wrap, rigid_box, specimen_card or paper_sleeve." }),
);

const unitsMessage = "Please enter how many units you need, as a whole number.";
const quantityEstimate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() !== "" ? Number(value) : value),
  z
    .number({ error: unitsMessage })
    .int(unitsMessage)
    .min(1, "Please ask for at least 1 unit.")
    .max(MAX_UNITS, `For more than ${MAX_UNITS.toLocaleString("en-US")} units, please contact us instead.`),
);

const companyName = text("Please enter your company name.").pipe(
  z
    .string()
    .min(1, { error: "Please enter your company name.", abort: true })
    .min(2, "The company name needs at least 2 characters.")
    .max(80, "The company name can be at most 80 characters."),
);

const contactName = text("Please enter the name of the contact person.").pipe(
  z
    .string()
    .min(1, { error: "Please enter the name of the contact person.", abort: true })
    .min(2, "The contact name needs at least 2 characters.")
    .max(80, "The contact name can be at most 80 characters."),
);

// notes are optional, an empty one counts as none
const notes = text("The notes must be text.")
  .pipe(z.string().max(2000, "The notes can be at most 2000 characters."))
  .transform((value) => (value === "" ? undefined : value))
  .optional();

export const quoteRequestSchema = z.object({
  cacaoProfile,
  packagingType,
  quantityEstimate,
  companyName,
  contactName,
  notes,
});

export type QuoteRequestInput = z.output<typeof quoteRequestSchema>;
