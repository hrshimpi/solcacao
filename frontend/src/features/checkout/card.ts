// Small helpers for the card fields: what a person types is shown in groups, and the brand is named from the first digits.
export const digitsOnly = (value: string) => value.replace(/\D/g, "");

// 4242424242424242 is written 4242 4242 4242 4242 (American Express: 4 6 5)
export function formatCardNumber(value: string): string {
  const digits = digitsOnly(value).slice(0, 19);
  if (/^3[47]/.test(digits)) {
    return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 15)].filter(Boolean).join(" ");
  }
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

// 1230 is written 12/30, and a month that cannot be one gets a 0 in front (4 is 04)
export function formatExpiry(value: string): string {
  const digits = digitsOnly(value).slice(0, 4);
  if (digits.length === 0) return "";
  if (digits.length === 1) return Number(digits) > 1 ? `0${digits}/` : digits;
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export type Brand = "visa" | "mastercard" | "amex" | "discover" | "card";

export function brandOf(number: string): Brand {
  const digits = digitsOnly(number);
  if (/^4/.test(digits)) return "visa";
  if (/^(5[1-5]|222[1-9]|22[3-9]|2[3-6]|27[01]|2720)/.test(digits)) return "mastercard";
  if (/^3[47]/.test(digits)) return "amex";
  if (/^(6011|65|64[4-9])/.test(digits)) return "discover";
  return "card";
}
