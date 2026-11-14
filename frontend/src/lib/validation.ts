// Shared validation rules for every form. A rule returns an error (a translation key) or null.
export interface FieldError {
  key:
    | "errors.required"
    | "errors.email"
    | "errors.minLength"
    | "errors.maxLength"
    | "errors.minNumber"
    | "errors.maxNumber"
    | "errors.wholeNumber"
    | "errors.phone"
    | "errors.password"
    | "errors.passwordLong"
    | "errors.postalCode";
  params?: Record<string, number>;
}

export type Rule = (value: string) => FieldError | null;

export const required: Rule = (value) => (value.trim() ? null : { key: "errors.required" });

export const email: Rule = (value) =>
  !value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()) ? null : { key: "errors.email" };

export const phone: Rule = (value) =>
  !value.trim() || /^[+()\d\s-]{7,20}$/.test(value.trim()) ? null : { key: "errors.phone" };

// a new password: at least 10 characters with a letter and a number, and at most 72 bytes (what the server can keep).
// An empty value is left to the required rule.
export const newPassword: Rule = (value) => {
  if (!value) return null;
  if (new TextEncoder().encode(value).length > 72) return { key: "errors.passwordLong" };
  return value.length >= 10 && /\p{L}/u.test(value) && /\p{N}/u.test(value) ? null : { key: "errors.password" };
};

// a zip code or postal code: letters, numbers, spaces and dashes, starting with a letter or a number
export const postalCode: Rule = (value) => (!value.trim() || /^[A-Za-z0-9][A-Za-z0-9 -]*$/.test(value.trim()) ? null : { key: "errors.postalCode" });

export const minLength =
  (count: number): Rule =>
  (value) =>
    !value || value.length >= count ? null : { key: "errors.minLength", params: { count } };

export const maxLength =
  (count: number): Rule =>
  (value) =>
    value.length <= count ? null : { key: "errors.maxLength", params: { count } };

export const wholeNumber: Rule = (value) =>
  !value.trim() || /^\d+$/.test(value.trim()) ? null : { key: "errors.wholeNumber" };

export const minNumber =
  (count: number): Rule =>
  (value) =>
    !value.trim() || !/^\d+$/.test(value.trim()) || Number(value) >= count
      ? null
      : { key: "errors.minNumber", params: { count } };

export const maxNumber =
  (count: number): Rule =>
  (value) =>
    !value.trim() || !/^\d+$/.test(value.trim()) || Number(value) <= count
      ? null
      : { key: "errors.maxNumber", params: { count } };

// returns the first rule that fails, or null when the value is fine
export function validateValue(value: string, rules: Rule[]): FieldError | null {
  for (const rule of rules) {
    const error = rule(value);
    if (error) return error;
  }
  return null;
}
