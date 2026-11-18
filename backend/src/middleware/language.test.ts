import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { detectLanguage, languageFromHeader, languageOf, localize } from "./language.ts";

describe("languageFromHeader", () => {
  it("takes the language that is asked for, also with a region", () => {
    expect(languageFromHeader("es")).toBe("es");
    expect(languageFromHeader("es-MX")).toBe("es");
    expect(languageFromHeader("EN-us")).toBe("en");
  });

  it("takes the one with the highest weight, and the first one when the weight is the same", () => {
    expect(languageFromHeader("en;q=0.5,es;q=0.9")).toBe("es");
    expect(languageFromHeader("es-MX,es;q=0.9,en;q=0.8")).toBe("es");
    expect(languageFromHeader("en,es")).toBe("en");
    expect(languageFromHeader("fr,es;q=0.2")).toBe("es");
  });

  it("does not take a language that the browser does not want, or that we do not have", () => {
    expect(languageFromHeader("es;q=0,en;q=0.1")).toBe("en");
    expect(languageFromHeader("fr,de;q=0.8")).toBeUndefined();
    expect(languageFromHeader("*")).toBeUndefined();
  });

  it("copes with a header that is empty, odd or very long", () => {
    expect(languageFromHeader(undefined)).toBeUndefined();
    expect(languageFromHeader("")).toBeUndefined();
    expect(languageFromHeader(";;;,,,q=")).toBeUndefined();
    expect(languageFromHeader("es;q=abc")).toBeUndefined();
    expect(languageFromHeader(`${"fr,".repeat(500)}es`)).toBeUndefined();
  });
});

describe("languageOf", () => {
  it("lets ?lang win over the header, and falls back to English", () => {
    expect(languageOf("en", "es")).toBe("en");
    expect(languageOf("es", "en")).toBe("es");
    expect(languageOf(undefined, "es")).toBe("es");
    expect(languageOf(undefined, undefined)).toBe("en");
  });

  it("ignores a ?lang that is not English or Spanish, whatever its type", () => {
    for (const value of ["fr", "", "EN", ["es"], { $ne: "en" }, 5, null]) {
      expect(languageOf(value, "es"), JSON.stringify(value)).toBe("es");
    }
  });
});

describe("detectLanguage", () => {
  const app = express();
  app.use(detectLanguage);
  app.get("/lang", (req, res) => void res.json({ lang: req.lang }));

  it("puts the language on the request, and tells caches that the answer depends on it", async () => {
    const res = await request(app).get("/lang").set("Accept-Language", "es-ES,es;q=0.9");

    expect(res.body.lang).toBe("es");
    expect(res.headers.vary).toMatch(/Accept-Language/i);
  });

  it("uses the query over the header", async () => {
    expect((await request(app).get("/lang?lang=en").set("Accept-Language", "es")).body.lang).toBe("en");
  });

  it("uses English when nothing is said", async () => {
    expect((await request(app).get("/lang")).body.lang).toBe("en");
  });
});

describe("localize", () => {
  it("gives the text in the language, and the English text when the Spanish is missing or empty", () => {
    expect(localize({ en: "Dark", es: "Oscuro" }, "es")).toBe("Oscuro");
    expect(localize({ en: "Dark", es: "Oscuro" }, "en")).toBe("Dark");
    expect(localize({ en: "Dark" }, "es")).toBe("Dark");
    expect(localize({ en: "Dark", es: "" }, "es")).toBe("Dark");
    expect(localize({ en: "Dark", es: "   " }, "es")).toBe("Dark");
    expect(localize({ en: "Dark", es: null }, "es")).toBe("Dark");
  });
});
