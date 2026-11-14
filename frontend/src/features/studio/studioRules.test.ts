import { validateValue } from "../../lib/validation";
import { isSmallRun, MAX_UNITS, reviewRules, type ReviewField } from "./studioRules";

const check = (field: ReviewField, value: string) => validateValue(value, reviewRules[field]);

describe("review rules", () => {
  describe.each(["companyName", "contactName"] as const)("%s", (field) => {
    it("is required, and spaces only do not count", () => {
      expect(check(field, "")).toEqual({ key: "errors.required" });
      expect(check(field, "    ")).toEqual({ key: "errors.required" });
    });

    it("needs at least two characters once the spaces around it are taken away", () => {
      expect(check(field, "A")).toEqual({ key: "errors.minLength", params: { count: 2 } });
      expect(check(field, " A ")).toEqual({ key: "errors.minLength", params: { count: 2 } });
      expect(check(field, "AB")).toBeNull();
    });

    it("takes at most 80 characters", () => {
      expect(check(field, "a".repeat(80))).toBeNull();
      expect(check(field, "a".repeat(81))).toEqual({ key: "errors.maxLength", params: { count: 80 } });
      expect(check(field, ` ${"a".repeat(80)} `)).toBeNull();
    });
  });

  describe("units", () => {
    it("is required", () => {
      expect(check("units", "")).toEqual({ key: "errors.required" });
      expect(check("units", "  ")).toEqual({ key: "errors.required" });
    });

    it.each(["abc", "12.5", "1,000", "-5", "+5", "1e3", "10 000"])("must be a whole number: %s", (value) => {
      expect(check("units", value)).toEqual({ key: "errors.wholeNumber" });
    });

    it("must be at least one", () => {
      expect(check("units", "0")).toEqual({ key: "errors.minNumber", params: { count: 1 } });
      expect(check("units", "1")).toBeNull();
    });

    it("takes a small number, because under 500 is only a warning", () => {
      expect(check("units", "100")).toBeNull();
      expect(check("units", "499")).toBeNull();
      expect(check("units", "500")).toBeNull();
    });

    it("takes at most ten million, like the server", () => {
      expect(MAX_UNITS).toBe(10_000_000);
      expect(check("units", "10000000")).toBeNull();
      expect(check("units", "10000001")).toEqual({ key: "errors.maxNumber", params: { count: 10_000_000 } });
    });
  });

  describe("notes", () => {
    it("are optional", () => {
      expect(check("notes", "")).toBeNull();
    });

    it("take at most 2000 characters, like the server", () => {
      expect(check("notes", "a".repeat(2000))).toBeNull();
      expect(check("notes", "a".repeat(2001))).toEqual({ key: "errors.maxLength", params: { count: 2000 } });
    });
  });
});

describe("isSmallRun", () => {
  it.each(["1", "100", "499", " 250 ", "0100"])("is true for %s", (value) => {
    expect(isSmallRun(value)).toBe(true);
  });

  it.each(["500", "800", "10000000", "0", "", "  ", "abc", "12.5", "-5", "1e2"])("is false for %s", (value) => {
    expect(isSmallRun(value)).toBe(false);
  });
});
