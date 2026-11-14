// What to tell a person when the contact form or the newsletter box could not send, in their language. The server explains
// a problem with a code, and the text for each code lives here (and in the dictionaries), as for the account forms.
import type { TFunction } from "i18next";
import { ApiError } from "../../lib/apiFetch";

type InquiryField = "name" | "email" | "message";

export interface InquiryProblem {
  // a message for each field the server named
  fields: Partial<Record<InquiryField, string>>;
  // a message for the whole form, when no field is to blame
  form?: string;
}

export function inquiryProblem(error: unknown, t: TFunction): InquiryProblem {
  if (error instanceof ApiError) {
    if (error.code === "RATE_LIMITED" || error.status === 429) return { fields: {}, form: t("contact.errors.tooMany") };
    if (error.status === 0) return { fields: {}, form: t("contact.errors.network") };

    // the server's own words for a field are in English, so a field it names gets the message of our own form
    if (error.code === "VALIDATION_ERROR") {
      const fields: InquiryProblem["fields"] = {};
      for (const detail of error.details) {
        if (detail.field === "email" && !fields.email) fields.email = t("errors.email");
        else if (detail.field === "name" && !fields.name) fields.name = t("errors.minLength", { count: 2 });
        else if (detail.field === "message" && !fields.message) fields.message = t("errors.minLength", { count: 10 });
      }
      if (Object.keys(fields).length > 0) return { fields };
    }
  }
  return { fields: {}, form: t("contact.errors.unknown") };
}
