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
    | "errors.phone";
  params?: Record<string, number>;
}

export type Rule = (value: string) => FieldError | null;

export const required: Rule = (value) => (value.trim() ? null : { key: "errors.required" });

export const email: Rule = (value) =>
  !value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()) ? null : { key: "errors.email" };

export const phone: Rule = (value) =>
  !value.trim() || /^[+()\d\s-]{7,20}$/.test(value.trim()) ? null : { key: "errors.phone" };

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
