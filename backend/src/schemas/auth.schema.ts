// The zod schemas for the sign up and sign in routes, and the pieces that the account routes share
// (name, email, password). Text is trimmed and stripped of tags, and the messages are written for the person
// filling in the form. Only the fields named here get through, so nothing like "role" can be slipped in.
import { z } from "zod";
import { accountTypes, languages } from "../models/user.model.ts";
import { text } from "./plain-text.ts";

export const nameField = text("Please enter your name.").pipe(
  z
    .string()
    .min(1, { error: "Please enter your name.", abort: true })
    .min(2, "Your name needs at least 2 characters.")
    .max(80, "Your name can be at most 80 characters."),
);

export const emailField = text("Please enter your email address.").pipe(
  z
    .string()
    .min(1, { error: "Please enter your email address.", abort: true })
    .max(254, "That email address is too long.")
    .toLowerCase()
    .pipe(z.email("That email address doesn't look right. It should look like name@example.com.")),
);

export const companyField = text("Please enter your company name.").pipe(
  z
    .string()
    .min(1, { error: "Please enter your company name.", abort: true })
    .max(120, "The company name can be at most 120 characters."),
);

// the ones that everybody tries first
const tooCommon = new Set([
  "password123",
  "password1234",
  "1234567890a",
  "qwerty12345",
  "qwertyuiop1",
  "iloveyou123",
  "welcome1234",
  "letmein1234",
  "admin12345",
  "abc1234567",
]);

export const passwordMessage = "Use at least 10 characters, with at least one letter and one number.";

// not trimmed or cleaned: a password is taken exactly as it was typed. bcrypt only reads 72 bytes, so more is refused.
export const passwordField = z
  .string({ error: "Please choose a password." })
  .min(1, { error: "Please choose a password.", abort: true })
  .min(10, { error: passwordMessage, abort: true })
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72, { error: "That password is too long. Use at most 72 characters.", abort: true })
  .refine((value) => /\p{L}/u.test(value) && /\p{N}/u.test(value), { error: passwordMessage, abort: true })
  .refine((value) => !tooCommon.has(value.toLowerCase()), "That password is too easy to guess. Please choose another one.");

const language = z.enum(languages, { error: "Choose English or Spanish." });

export const registerSchema = z
  .object({
    name: nameField,
    email: emailField,
    password: passwordField,
    accountType: z.enum(accountTypes, { error: "Choose a retail or a business account." }).default("retail"),
    companyName: companyField.optional(),
    preferredLanguage: language.default("en"),
  })
  .superRefine((input, context) => {
    if (input.accountType === "b2b" && input.companyName === undefined) {
      context.addIssue({ code: "custom", path: ["companyName"], message: "Please enter your company name." });
    }
  });

// the sign in only checks that something was sent, whether it is right is for the check against the account.
// A password is not held to the rules for new ones here, so that nobody is locked out by a rule that changed.
export const loginSchema = z.object({
  email: z
    .string({ error: "Please enter your email address." })
    .trim()
    .min(1, "Please enter your email address.")
    .max(254, "That email address is too long.")
    .toLowerCase(),
  password: z.string({ error: "Please enter your password." }).min(1, "Please enter your password.").max(200, "That password is too long."),
});

export const forgotPasswordSchema = z.object({ email: emailField });

// the reset token is 32 random bytes written in base64url, so only that shape can be a real one
export const resetPasswordSchema = z.object({
  token: z.string({ error: "This reset link is not valid." }).regex(/^[A-Za-z0-9_-]{43}$/, "This reset link is not valid."),
  password: passwordField,
});

export type RegisterInput = z.output<typeof registerSchema>;
export type LoginInput = z.output<typeof loginSchema>;
