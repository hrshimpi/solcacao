import { getProducts } from "../../data/products";
import { applyFilters, defaultFilters, filtersFromParams, hasActiveFilters, paramsFromFilters } from "./filters";

const products = getProducts("en");

describe("shop filters in the address", () => {
  it("uses the defaults when the address has no filters", () => {
    expect(filtersFromParams(new URLSearchParams(""))).toEqual(defaultFilters);
    expect(hasActiveFilters(defaultFilters)).toBe(false);
  });

  it("reads every filter from the address", () => {
    const filters = filtersFromParams(new URLSearchParams("min=65&max=80&origin=peru,ecuador&category=bar&notes=fruity"));

    expect(filters).toEqual({ min: 65, max: 80, origins: ["peru", "ecuador"], category: "bar", notes: ["fruity"] });
  });

  it("ignores values that are not allowed", () => {
    const filters = filtersFromParams(new URLSearchParams("min=abc&origin=mars,peru&category=cake&notes=spicy"));

    expect(filters.min).toBe(defaultFilters.min);
    expect(filters.origins).toEqual(["peru"]);
    expect(filters.category).toBe("all");
    expect(filters.notes).toEqual([]);
  });

  it("keeps the range inside the slider and keeps the two handles apart", () => {
    const filters = filtersFromParams(new URLSearchParams("min=90&max=10"));

    expect(filters.min).toBeLessThanOrEqual(83);
    expect(filters.max - filters.min).toBeGreaterThanOrEqual(2);
    expect(filters.max).toBeLessThanOrEqual(85);
  });

  it("writes only the values that differ from the defaults", () => {
    expect(paramsFromFilters(defaultFilters).toString()).toBe("");
    expect(paramsFromFilters({ ...defaultFilters, category: "truffle", origins: ["peru"] }).toString()).toBe(
      "origin=peru&category=truffle",
    );
  });

  it("filters products by origin and category", () => {
    const peruvian = applyFilters(products, { ...defaultFilters, min: 55, origins: ["peru"] });
    expect(peruvian.length).toBeGreaterThan(0);
    expect(peruvian.every((product) => product.origin === "peru")).toBe(true);

    const truffles = applyFilters(products, { ...defaultFilters, min: 55, category: "truffle" });
    expect(truffles.every((product) => product.category === "truffle")).toBe(true);
  });

  it("filters products by cacao percentage", () => {
    const strong = applyFilters(products, { ...defaultFilters, min: 75, max: 85 });

    expect(strong.every((product) => product.percentage >= 75)).toBe(true);
  });
});
