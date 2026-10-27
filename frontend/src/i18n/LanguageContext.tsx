// Gives every component the current language, its translate function and helpers for language aware links.
import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import type { TFunction } from "i18next";
import { useLocation, useNavigate } from "react-router";
import i18next, { isLang, type Lang } from "./index";

const STORAGE_KEY = "sc_lang";

interface LanguageValue {
  lang: Lang;
  t: TFunction;
  path: (to: string) => string;
  switchTo: (next: Lang) => void;
}

const LanguageContext = createContext<LanguageValue | null>(null);

export function savedLanguage(): Lang | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isLang(value ?? undefined) ? (value as Lang) : null;
  } catch {
    return null;
  }
}

export function preferredLanguage(): Lang {
  const saved = savedLanguage();
  if (saved) return saved;
  const browser = typeof navigator === "undefined" ? "" : navigator.language.toLowerCase();
  return browser.startsWith("es") ? "es" : "en";
}

function remember(lang: Lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // saving is a convenience only, the page works without it
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();

  const firstSegment = pathname.split("/")[1];
  const hasPrefix = isLang(firstSegment);
  const lang: Lang = hasPrefix ? firstSegment : preferredLanguage();

  const t = useMemo(() => i18next.getFixedT(lang), [lang]);

  useEffect(() => {
    document.documentElement.lang = lang;
    if (hasPrefix) remember(lang);
  }, [lang, hasPrefix]);

  const value = useMemo<LanguageValue>(
    () => ({
      lang,
      t,
      path: (to) => `/${lang}${to === "/" ? "" : to.startsWith("/#") || to.startsWith("/?") ? to.slice(1) : to}`,
      switchTo: (next) => {
        remember(next);
        const rest = hasPrefix ? pathname.slice(firstSegment.length + 1) : pathname;
        navigate(`/${next}${rest === "/" ? "" : rest}${search}${hash}`);
      },
    }),
    [lang, t, hasPrefix, firstSegment, pathname, search, hash, navigate],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLang must be used inside LanguageProvider");
  return value;
}
