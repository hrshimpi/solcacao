// What to tell a person when an account call fails, in their language. The server explains problems with a code, and the
// text for each code lives here (and in the dictionaries) so the page speaks the language of the person, not the one of the server.
import type { TFunction } from "i18next";
import { ApiError } from "../../lib/apiFetch";

// the part of a problem that is not about one field: the network, the limits, and what we did not expect
function general(error: unknown, t: TFunction): string {
  if (error instanceof ApiError) {
    if (error.code === "TOO_MANY_ATTEMPTS" || error.code === "RATE_LIMITED" || error.status === 429) return t("auth.errors.tooMany");
    if (error.status === 0) return t("auth.errors.network");
  }
  return t("auth.errors.unknown");
}

export function signInMessage(error: unknown, t: TFunction): string {
  if (error instanceof ApiError && error.code === "INVALID_CREDENTIALS") return t("auth.errors.invalid");
  return general(error, t);
}

// the names of the fields in the sign up form for the names the server uses
const registerFields: Record<string, "name" | "company" | "email" | "password"> = { name: "name", companyName: "company", email: "email", password: "password" };

export interface RegisterProblem {
  // a message for each field the server named
  fields: Partial<Record<"name" | "company" | "email" | "password", string>>;
  // a message for the whole form, when no field is to blame
  form?: string;
}

export function registerProblem(error: unknown, t: TFunction): RegisterProblem {
  if (error instanceof ApiError) {
    if (error.code === "EMAIL_TAKEN") return { fields: { email: t("auth.errors.emailTaken") } };

    // the server's own words for a field are in English, so a field it names gets the message of our own form
    if (error.code === "VALIDATION_ERROR") {
      const fields: RegisterProblem["fields"] = {};
      for (const detail of error.details) {
        const field = detail.field ? registerFields[detail.field] : undefined;
        if (!field || fields[field]) continue;
        fields[field] = field === "email" ? t("errors.email") : field === "password" ? t("errors.password") : t("errors.required");
      }
      if (Object.keys(fields).length > 0) return { fields };
    }
  }
  return { fields: {}, form: general(error, t) };
}
