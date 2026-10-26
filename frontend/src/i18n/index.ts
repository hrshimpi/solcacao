// Sets up i18next with the English and Spanish dictionaries and the list of supported languages.
import i18next from "i18next";
import { en } from "./en";
import { es } from "./es";

export type Lang = "en" | "es";

export const languages: Lang[] = ["en", "es"];

export function isLang(value: string | undefined): value is Lang {
  return value === "en" || value === "es";
}

i18next.init({
  resources: { en: { translation: en }, es: { translation: es } },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  initAsync: false,
});

export default i18next;
