import { productsFor } from "../../test/productFixtures";
import { searchProducts } from "./search";

const english = productsFor("en");
const spanish = productsFor("es");
const slugs = (found: { slug: string }[]) => found.map((product) => product.slug);

describe("searching the products", () => {
  it("finds a product by a part of its name, ignoring capitals", () => {
    expect(slugs(searchProducts(english, "MIDNIGHT"))).toEqual(["midnight-truffle"]);
    expect(slugs(searchProducts(english, "fleur de"))).toEqual(["fleur-de-sel-bar"]);
    expect(slugs(searchProducts(english, "72%"))).toEqual(["ecuador-72"]);
  });

  it("finds the products of a country by the name of the country", () => {
    // the truffle and the bar with salt are made with cacao from Ecuador, so they are found by it too
    expect(slugs(searchProducts(english, "ecuador"))).toEqual(["ecuador-72", "midnight-truffle", "fleur-de-sel-bar"]);
    expect(slugs(searchProducts(english, "peru"))).toEqual(["peru-68"]);
  });

  it("ignores accents on both sides: Peru finds Perú and the other way round", () => {
    expect(slugs(searchProducts(spanish, "peru"))).toContain("peru-68");
    expect(slugs(searchProducts(spanish, "Perú"))).toContain("peru-68");
    expect(slugs(searchProducts(english, "Perú"))).toContain("peru-68");
  });

  it("ignores spaces around what was typed", () => {
    expect(slugs(searchProducts(english, "   madagascar  "))).toEqual(["madagascar-80"]);
  });

  it("finds nothing for an empty search, or one that is only spaces or accents", () => {
    expect(searchProducts(english, "")).toEqual([]);
    expect(searchProducts(english, "    ")).toEqual([]);
    expect(searchProducts(english, "^")).toEqual([]);
  });

  it("finds nothing for a word that no product has", () => {
    expect(searchProducts(english, "banana")).toEqual([]);
  });

  it("treats what was typed as text, not as a pattern", () => {
    expect(searchProducts(english, ".*")).toEqual([]);
    expect(searchProducts(english, "(")).toEqual([]);
  });
});
