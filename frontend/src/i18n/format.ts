// Formats prices and months for the current language.
import type { Lang } from "./index";

const locales: Record<Lang, string> = { en: "en-US", es: "es-US" };

export function formatPrice(amount: number, lang: Lang) {
  return new Intl.NumberFormat(locales[lang], { style: "currency", currency: "USD" }).format(amount);
}

// month looks like "2024-03"
export function formatMonth(month: string, lang: Lang) {
  const [year, number] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(locales[lang], { month: "long", year: "numeric" }).format(
    new Date(year, number - 1, 1),
  );
}
