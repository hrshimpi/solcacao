import { cardCvc, cardExpiry, cardNumber, passesLuhn } from "../../lib/validation";
import { brandOf, digitsOnly, formatCardNumber, formatExpiry } from "./card";

describe("writing a card number", () => {
  it("groups the digits by four while they are typed", () => {
    expect(formatCardNumber("4")).toBe("4");
    expect(formatCardNumber("42424")).toBe("4242 4");
    expect(formatCardNumber("4242424242424242")).toBe("4242 4242 4242 4242");
  });

  it("takes spaces, dashes and letters out, and stops at 19 digits", () => {
    expect(formatCardNumber("4242-4242 abcd 4242")).toBe("4242 4242 4242");
    expect(formatCardNumber("1".repeat(30)).replace(/ /g, "")).toHaveLength(19);
    expect(digitsOnly("4242 4242-4242")).toBe("424242424242");
  });

  it("groups an American Express number as 4, 6 and 5", () => {
    expect(formatCardNumber("378282246310005")).toBe("3782 822463 10005");
  });
});

describe("writing an expiry date", () => {
  it("puts the slash in after the month", () => {
    expect(formatExpiry("1")).toBe("1");
    expect(formatExpiry("12")).toBe("12");
    expect(formatExpiry("123")).toBe("12/3");
    expect(formatExpiry("1230")).toBe("12/30");
  });

  it("writes a 0 in front of a month that cannot start with that digit", () => {
    expect(formatExpiry("4")).toBe("04/");
    expect(formatExpiry("0")).toBe("0");
  });

  it("takes anything that is not a digit out, and keeps four digits at most", () => {
    expect(formatExpiry("12/3x0")).toBe("12/30");
    expect(formatExpiry("123456")).toBe("12/34");
    expect(formatExpiry("")).toBe("");
  });
});

describe("naming a card", () => {
  it("knows the brand from the first digits", () => {
    expect(brandOf("4242 4242 4242 4242")).toBe("visa");
    expect(brandOf("5555555555554444")).toBe("mastercard");
    expect(brandOf("378282246310005")).toBe("amex");
    expect(brandOf("6011111111111117")).toBe("discover");
    expect(brandOf("9999")).toBe("card");
    expect(brandOf("")).toBe("card");
  });
});

describe("the rules of the card fields", () => {
  it("accepts a number that passes the check, with spaces, and nothing for an empty field (the required rule has that)", () => {
    expect(cardNumber("4242 4242 4242 4242")).toBeNull();
    expect(cardNumber("")).toBeNull();
    expect(cardNumber("4242 4242 4242 4241")?.key).toBe("checkout.errors.cardNumber");
    expect(cardNumber("1234")?.key).toBe("checkout.errors.cardNumber");
    expect(passesLuhn("378282246310005")).toBe(true);
  });

  it("accepts an expiry date of this month or later, and refuses one that passed or is not a date", () => {
    const rule = cardExpiry(() => new Date(2026, 10, 14));

    expect(rule("11/26")).toBeNull();
    expect(rule("12/26")).toBeNull();
    expect(rule("01/27")).toBeNull();
    expect(rule("10/26")?.key).toBe("checkout.errors.expiry");
    expect(rule("12/25")?.key).toBe("checkout.errors.expiry");
    expect(rule("13/30")?.key).toBe("checkout.errors.expiry");
    expect(rule("1/30")?.key).toBe("checkout.errors.expiry");
    expect(rule("")).toBeNull();
  });

  it("accepts a security code of 3 or 4 digits", () => {
    expect(cardCvc("123")).toBeNull();
    expect(cardCvc("1234")).toBeNull();
    expect(cardCvc("12")?.key).toBe("checkout.errors.cvc");
    expect(cardCvc("12a")?.key).toBe("checkout.errors.cvc");
  });
});
