// Formats prices and months for the current language.
import type { Lang } from "./index";

const locales: Record<Lang, string> = { en: "en-US", es: "es-US" };

export function formatPrice(amount: number, lang: Lang) {
  return new Intl.NumberFormat(locales[lang], { style: "currency", currency: "USD" }).format(amount);
}

// an amount in whole cents, like the quotes of the API (125000 is $1,250.00)
export function formatCents(cents: number, lang: Lang) {
  return formatPrice(cents / 100, lang);
}

export function formatNumber(value: number, lang: Lang) {
  return new Intl.NumberFormat(locales[lang]).format(value);
}

// a moment as the API sends it ("2026-10-26T20:54:00.000Z") written as a date. Something that is not a date gives "".
export function formatDate(moment: string, lang: Lang) {
  const date = new Date(moment);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locales[lang], { dateStyle: "medium" }).format(date);
}

// month looks like "2024-03"
export function formatMonth(month: string, lang: Lang) {
  const [year, number] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(locales[lang], { month: "long", year: "numeric" }).format(
    new Date(year, number - 1, 1),
  );
}
