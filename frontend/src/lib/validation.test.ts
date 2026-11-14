import { email, maxLength, maxNumber, minLength, minNumber, phone, required, validateValue, wholeNumber } from "./validation";

describe("validation rules", () => {
  it("required fails on empty and on spaces only", () => {
    expect(required("")).toEqual({ key: "errors.required" });
    expect(required("   ")).toEqual({ key: "errors.required" });
    expect(required("cacao")).toBeNull();
  });

  it("email accepts normal addresses and rejects broken ones", () => {
    expect(email("name@example.com")).toBeNull();
    expect(email("name@example")).toEqual({ key: "errors.email" });
    expect(email("name example.com")).toEqual({ key: "errors.email" });
  });

  it("email, phone and number rules leave an empty value to the required rule", () => {
    expect(email("")).toBeNull();
    expect(phone("")).toBeNull();
    expect(wholeNumber("")).toBeNull();
    expect(minNumber(500)("")).toBeNull();
    expect(maxNumber(500)("")).toBeNull();
  });

  it("phone accepts digits, spaces, plus and dashes", () => {
    expect(phone("+1 512 555-0184")).toBeNull();
    expect(phone("call me")).toEqual({ key: "errors.phone" });
  });

  it("length rules report the limit", () => {
    expect(minLength(8)("short")).toEqual({ key: "errors.minLength", params: { count: 8 } });
    expect(minLength(8)("long enough")).toBeNull();
    expect(maxLength(3)("abcd")).toEqual({ key: "errors.maxLength", params: { count: 3 } });
    expect(maxLength(3)("abc")).toBeNull();
  });

  it("number rules check whole numbers and the minimum", () => {
    expect(wholeNumber("12.5")).toEqual({ key: "errors.wholeNumber" });
    expect(wholeNumber("120")).toBeNull();
    expect(minNumber(500)("499")).toEqual({ key: "errors.minNumber", params: { count: 500 } });
    expect(minNumber(500)("500")).toBeNull();
  });

  it("maxNumber reports the limit and leaves text that is not a number to the whole number rule", () => {
    expect(maxNumber(500)("501")).toEqual({ key: "errors.maxNumber", params: { count: 500 } });
    expect(maxNumber(500)("500")).toBeNull();
    expect(maxNumber(500)("12.5")).toBeNull();
  });

  it("validateValue returns the first failing rule", () => {
    expect(validateValue("", [required, email])).toEqual({ key: "errors.required" });
    expect(validateValue("nope", [required, email])).toEqual({ key: "errors.email" });
    expect(validateValue("a@b.co", [required, email])).toBeNull();
  });
});
