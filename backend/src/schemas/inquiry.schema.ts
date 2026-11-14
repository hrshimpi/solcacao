// The zod schema for the inquiry form. One schema, with the rules picked by the category.
// All text is trimmed and stripped of HTML tags, so only plain text gets through.
// The error messages are written for the person filling in the form.
import { z } from "zod";
import type { InquiryCategory } from "../models/inquiry.model.ts";
import { text } from "./plain-text.ts";

const name = text("Please enter your name.").pipe(
  z
    .string()
    .min(1, { error: "Please enter your name.", abort: true })
    .min(2, "Your name needs at least 2 characters.")
    .max(80, "Your name can be at most 80 characters."),
);

const email = text("Please enter your email address.").pipe(
  z
    .string()
    .min(1, { error: "Please enter your email address.", abort: true })
    .max(254, "That email address is too long.")
    .toLowerCase()
    .pipe(z.email("That email address doesn't look right. It should look like name@example.com.")),
);

const message = text("Please write a message.").pipe(
  z
    .string()
    .min(1, { error: "Please write a message.", abort: true })
    .min(10, "Your message needs at least 10 characters.")
    .max(2000, "Your message can be at most 2000 characters."),
);

// feedback can come without a comment, an empty one counts as none
const optionalMessage = text("Your comment must be text.")
  .pipe(z.string().max(2000, "Your comment can be at most 2000 characters."))
  .transform((value) => (value === "" ? undefined : value))
  .optional();

// the same email rules, but the person may leave it out
const optionalEmail = z.preprocess((value) => (value === "" || value === null ? undefined : value), email.optional());

const ratingMessage = "Please give a rating from 1 to 5.";
// numbers can arrive as text from a form ("4"), anything else that is not a number stays wrong
const rating = z.preprocess(
  (value) => (typeof value === "string" && value.trim() !== "" ? Number(value) : value),
  z.number({ error: ratingMessage }).int(ratingMessage).min(1, ratingMessage).max(5, ratingMessage),
);

// the honeypot: a hidden field that people never see, so only a bot fills it in.
// The message is vague on purpose, so a bot does not learn what gave it away.
const honeypot = z.string().max(0, "We couldn't send this form. Please try again.").optional();

// the category goes first and is a literal, so zod can pick the right set of rules
const written = <Category extends Extract<InquiryCategory, "general" | "wholesale" | "support">>(category: Category) =>
  z.object({ category: z.literal(category), name, email, message, website: honeypot });

const feedback = z.object({
  category: z.literal("feedback" satisfies InquiryCategory),
  rating,
  message: optionalMessage,
  email: optionalEmail,
  website: honeypot,
});

const newsletter = z.object({
  category: z.literal("newsletter" satisfies InquiryCategory),
  email,
  website: honeypot,
});

export const inquirySchema = z
  .discriminatedUnion(
    "category",
    [written("general"), written("wholesale"), written("support"), feedback, newsletter],
    { error: "Please choose what your message is about: general, wholesale, support, feedback or newsletter." },
  )
  // the honeypot has done its job once it is checked, it should not travel any further
  .transform(({ website: _website, ...rest }) => rest);

// what the form sends, before it is checked and cleaned
export type InquiryRequest = z.input<typeof inquirySchema>;
// what is left after the checks: trimmed, plain text, no honeypot
export type InquiryInput = z.output<typeof inquirySchema>;
