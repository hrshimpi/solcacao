// The language of a request, in this order: ?lang=en|es, then the Accept-Language header (the best of English and
// Spanish that the browser asks for, by the weight it gave them), then English. It is on req.lang for every route.
// localize turns a bilingual value ({ en, es }) into plain text, and gives the English text when the Spanish is empty.
import type { RequestHandler } from "express";

export const languages = ["en", "es"] as const;
export type Lang = (typeof languages)[number];

declare global {
  namespace Express {
    interface Request {
      lang: Lang;
    }
  }
}

const isLang = (value: unknown): value is Lang => value === "en" || value === "es";

// "es-MX,es;q=0.9,en;q=0.8" gives es. A language with q=0 is one the browser does not want.
export function languageFromHeader(header: string | undefined): Lang | undefined {
  if (!header) return undefined;

  const wanted = header
    .slice(0, 200)
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      // no q means 1, and a q that is not a number makes the entry unusable
      const given = params.find((param) => /^\s*q\s*=/i.test(param));
      const weight = given === undefined ? 1 : /^\s*q\s*=\s*(\d+(?:\.\d+)?)\s*$/i.exec(given)?.[1];
      return { lang: tag.trim().toLowerCase().split("-")[0], weight: weight === undefined ? Number.NaN : Number(weight), index };
    })
    .filter((entry) => isLang(entry.lang) && Number.isFinite(entry.weight) && entry.weight > 0)
    // the heaviest first, and the one that came first when the weight is the same
    .sort((a, b) => b.weight - a.weight || a.index - b.index);

  return wanted[0]?.lang as Lang | undefined;
}

export function languageOf(query: unknown, header: string | undefined): Lang {
  return (isLang(query) ? query : undefined) ?? languageFromHeader(header) ?? "en";
}

export const detectLanguage: RequestHandler = (req, res, next) => {
  req.lang = languageOf(req.query.lang, req.headers["accept-language"]);
  // answers that depend on the language must not be mixed up by a cache
  res.vary("Accept-Language");
  next();
};

export interface Bilingual {
  en: string;
  es?: string | null;
}

export function localize(value: Bilingual, lang: Lang): string {
  const text = value[lang];
  return typeof text === "string" && text.trim() !== "" ? text : value.en;
}
