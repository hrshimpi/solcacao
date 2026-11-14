// The zod schemas for the account area: the profile, the password, the addresses and the business details.
// The ones that change a record are strict: a field that is not in the list (like "role" or "email") is an
// error, not something that is quietly dropped, so nobody can think that it worked.
import { z } from "zod";
import { languages } from "../models/user.model.ts";
import { verificationStatuses } from "../models/b2b-profile.model.ts";
import { companyField, nameField, passwordField } from "./auth.schema.ts";
import { text } from "./plain-text.ts";

export const addressIdSchema = z.string().regex(/^[0-9a-f]{24}$/i, "That isn't a valid address id.");
export const userIdSchema = z.string().regex(/^[0-9a-f]{24}$/i, "That isn't a valid user id.");

// the phone number looks like a phone number, and an empty one takes it away
const phone = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z
    .string({ error: "Please enter a phone number." })
    .trim()
    .regex(/^[0-9+()\-.\s]{5,30}$/, "That phone number doesn't look right. Use digits, spaces, + ( ) - and . only, at most 30 characters.")
    .nullable(),
);

const onlyThese = (names: string) => ({ error: (issue: { code: string }) => (issue.code === "unrecognized_keys" ? `You can only change ${names} here.` : undefined) });

export const profilePatchSchema = z
  .strictObject(
    {
      name: nameField.optional(),
      phone: phone.optional(),
      preferredLanguage: z.enum(languages, { error: "Choose English or Spanish." }).optional(),
      marketingEmails: z.boolean({ error: "marketingEmails must be true or false." }).optional(),
    },
    onlyThese("your name, phone, language and email choice"),
  )
  .refine((patch) => Object.values(patch).some((value) => value !== undefined), "Send at least one thing to change.");

export const passwordChangeSchema = z
  .strictObject(
    {
      currentPassword: z.string({ error: "Please enter your current password." }).min(1, "Please enter your current password.").max(200, "That password is too long."),
      newPassword: passwordField,
    },
    onlyThese("the current and the new password"),
  )
  .refine((input) => input.currentPassword !== input.newPassword, { path: ["newPassword"], message: "Your new password has to be different from the current one." });

const addressText = (missing: string, max: number, min = 1) =>
  text(missing).pipe(z.string().min(1, { error: missing, abort: true }).min(min, `That needs at least ${min} characters.`).max(max, `That can be at most ${max} characters.`));

const addressFields = {
  label: addressText("Please name this address, like Home or Office.", 40),
  street: addressText("Please enter the street address.", 120),
  street2: text("The second address line must be text.")
    .pipe(z.string().max(120, "That can be at most 120 characters."))
    .transform((value) => (value === "" ? undefined : value)),
  city: addressText("Please enter the city.", 80),
  state: addressText("Please enter the state or region.", 80),
  postalCode: addressText("Please enter the zip code.", 20, 2).pipe(z.string().regex(/^[A-Za-z0-9][A-Za-z0-9 -]*$/, "The zip code can only have letters, numbers, spaces and dashes.")),
  country: addressText("Please enter the country.", 80, 2),
};

const addressWords = "the parts of the address";

export const addressCreateSchema = z.strictObject(
  { ...addressFields, street2: addressFields.street2.optional(), isDefault: z.boolean({ error: "isDefault must be true or false." }).optional() },
  onlyThese(`${addressWords} and whether it is the default`),
);

// a change to an address names only what changes. Which one is the default is changed with its own call.
export const addressPatchSchema = z
  .strictObject(
    {
      label: addressFields.label.optional(),
      street: addressFields.street.optional(),
      // an empty second line takes it away
      street2: text("The second address line must be text.")
        .pipe(z.string().max(120, "That can be at most 120 characters."))
        .transform((value) => (value === "" ? null : value))
        .optional(),
      city: addressFields.city.optional(),
      state: addressFields.state.optional(),
      postalCode: addressFields.postalCode.optional(),
      country: addressFields.country.optional(),
    },
    onlyThese(addressWords),
  )
  .refine((patch) => Object.values(patch).some((value) => value !== undefined), "Send at least one thing to change.");

// an empty value takes the optional details away
const optionalDetail = (label: string, max: number) =>
  text(`${label} must be text.`)
    .pipe(z.string().max(max, `${label} can be at most ${max} characters.`))
    .transform((value) => (value === "" ? null : value));

export const b2bProfileSchema = z.strictObject(
  {
    companyName: companyField,
    taxId: optionalDetail("The tax id", 40).optional(),
    industry: optionalDetail("The industry", 80).optional(),
  },
  onlyThese("the company, tax id and industry"),
);

export const verificationSchema = z.strictObject(
  { verificationStatus: z.enum(verificationStatuses, { error: `verificationStatus must be one of ${verificationStatuses.join(", ")}.` }) },
  onlyThese("the verification status"),
);

export type ProfilePatch = z.output<typeof profilePatchSchema>;
export type AddressCreateInput = z.output<typeof addressCreateSchema>;
export type AddressPatch = z.output<typeof addressPatchSchema>;
export type B2BProfileBody = z.output<typeof b2bProfileSchema>;
