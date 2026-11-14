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
    | "errors.postalCode"
    | "checkout.errors.cardNumber"
    | "checkout.errors.expiry"
    | "checkout.errors.cvc"
    | "errors.slug"
    | "errors.sku"
    | "errors.month"
    | "errors.imageUrl"
    | "errors.price";
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

// a card number: 12 to 19 digits (spaces and dashes are ignored) that pass the check every real number passes
export function passesLuhn(number: string): boolean {
  if (!/^\d{12,19}$/.test(number)) return false;
  let sum = 0;
  for (let index = 0; index < number.length; index++) {
    let digit = Number(number[number.length - 1 - index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

export const cardNumber: Rule = (value) => (!value.trim() || passesLuhn(value.replace(/[\s-]/g, "")) ? null : { key: "checkout.errors.cardNumber" });

// MM/YY of a month that has not passed
export const cardExpiry =
  (now: () => Date = () => new Date()): Rule =>
  (value) => {
    if (!value.trim()) return null;
    const found = /^(0[1-9]|1[0-2])\s?\/\s?(\d{2})$/.exec(value.trim());
    if (!found) return { key: "checkout.errors.expiry" };
    const today = now();
    const year = 2000 + Number(found[2]);
    const month = Number(found[1]);
    return year > today.getFullYear() || (year === today.getFullYear() && month >= today.getMonth() + 1) ? null : { key: "checkout.errors.expiry" };
  };

export const cardCvc: Rule = (value) => (!value.trim() || /^\d{3,4}$/.test(value.trim()) ? null : { key: "checkout.errors.cvc" });

// the address of a product page: lower case words joined with dashes
export const slug: Rule = (value) => (!value.trim() || /^[a-z0-9]+(-[a-z0-9]+)*$/i.test(value.trim()) ? null : { key: "errors.slug" });

// the code of a product: capitals, numbers and dashes (it is written in capitals on the way out)
export const sku: Rule = (value) => (!value.trim() || /^[A-Z0-9][A-Z0-9-]*$/i.test(value.trim()) ? null : { key: "errors.sku" });

// a month like 2024-09
export const month: Rule = (value) => (!value.trim() || /^\d{4}-(0[1-9]|1[0-2])$/.test(value.trim()) ? null : { key: "errors.month" });

// a web address that starts with https://, or a photo of the site that starts with /
export const imageUrl: Rule = (value) => (!value.trim() || /^(https:\/\/|\/)[^\s"'<>]+$/i.test(value.trim()) ? null : { key: "errors.imageUrl" });

// a price in dollars with at most two decimals, more than nothing
export const price: Rule = (value) => (!value.trim() || (/^\d+([.,]\d{1,2})?$/.test(value.trim()) && Number(value.trim().replace(",", ".")) > 0) ? null : { key: "errors.price" });

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
