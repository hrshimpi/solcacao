// The small rules of checkout: what an order costs, how a card is checked, and how an order moves.
import { describe, expect, it } from "vitest";
import { orderStatuses } from "../models/order.model.ts";
import { canChange, customerCanCancel, nextStatuses } from "./order-status.ts";
import { brandOf, createDemoGateway, passesLuhn } from "./payment.service.ts";
import { shippingOptions, shippingPrice, taxOf, totalsFor } from "./pricing.ts";

describe("what an order costs", () => {
  it("charges standard shipping under $60.00 and nothing from $60.00 of products", () => {
    expect(shippingPrice("standard", 5999)).toBe(595);
    expect(shippingPrice("standard", 6000)).toBe(0);
    expect(shippingPrice("standard", 25000)).toBe(0);
  });

  it("charges express shipping always", () => {
    expect(shippingPrice("express", 100)).toBe(1495);
    expect(shippingPrice("express", 100000)).toBe(1495);
  });

  it("works out 8.25% tax on the products, in whole cents", () => {
    expect(taxOf(0)).toBe(0);
    expect(taxOf(1000)).toBe(83);
    expect(taxOf(2400)).toBe(198);
    expect(Number.isInteger(taxOf(1234))).toBe(true);
  });

  it("adds the products, the shipping and the tax into the total", () => {
    expect(totalsFor(2400, "standard")).toEqual({ subtotal: 2400, shipping: 595, tax: 198, total: 3193 });
    expect(totalsFor(7000, "standard")).toEqual({ subtotal: 7000, shipping: 0, tax: 578, total: 7578 });
    expect(totalsFor(2400, "express").total).toBe(2400 + 1495 + 198);
  });

  it("lists the ways to ship with what each costs for this cart, and when it arrives", () => {
    expect(shippingOptions(2400)).toEqual([
      { id: "standard", price: 595, days: [3, 5] },
      { id: "express", price: 1495, days: [1, 2] },
    ]);
    expect(shippingOptions(9000)[0].price).toBe(0);
  });
});

describe("the card", () => {
  it("passes the Luhn check for real numbers and fails for numbers with a wrong digit", () => {
    expect(passesLuhn("4242424242424242")).toBe(true);
    expect(passesLuhn("5555555555554444")).toBe(true);
    expect(passesLuhn("378282246310005")).toBe(true);
    expect(passesLuhn("4242424242424241")).toBe(false);
    expect(passesLuhn("1234")).toBe(false);
    expect(passesLuhn("4242 4242 4242 4242")).toBe(false);
  });

  it("knows the brand from the first digits", () => {
    expect(brandOf("4242424242424242")).toBe("visa");
    expect(brandOf("5555555555554444")).toBe("mastercard");
    expect(brandOf("2223003122003222")).toBe("mastercard");
    expect(brandOf("378282246310005")).toBe("amex");
    expect(brandOf("6011111111111117")).toBe("discover");
    expect(brandOf("9999999999999995")).toBe("card");
  });
});

describe("the made up payment service", () => {
  const gateway = createDemoGateway({ now: () => new Date("2026-11-14T12:00:00.000Z"), makeReference: () => "abc123" });
  const good = { number: "4242424242424242", expMonth: 12, expYear: 2030, cvc: "123", name: "Isabel Vasquez" };

  it("takes a good card, and answers the brand, the last four digits and a reference, but never the number", async () => {
    const result = await gateway.charge({ amount: 3193, card: good });

    expect(result).toEqual({ ok: true, reference: "demo_abc123", brand: "visa", last4: "4242" });
    expect(JSON.stringify(result)).not.toContain("4242424242424242");
  });

  it("refuses a number that does not pass the check, and an amount that makes no sense", async () => {
    expect(await gateway.charge({ amount: 100, card: { ...good, number: "4242424242424241" } })).toEqual({ ok: false, reason: "invalid_card" });
    expect(await gateway.charge({ amount: 0, card: good })).toEqual({ ok: false, reason: "invalid_card" });
    expect(await gateway.charge({ amount: 10.5, card: good })).toEqual({ ok: false, reason: "invalid_card" });
  });

  it("refuses a card that is out of date, and accepts one that expires this month", async () => {
    expect(await gateway.charge({ amount: 100, card: { ...good, expYear: 2026, expMonth: 10 } })).toEqual({ ok: false, reason: "expired_card" });
    expect(await gateway.charge({ amount: 100, card: { ...good, expYear: 2025, expMonth: 12 } })).toEqual({ ok: false, reason: "expired_card" });
    expect((await gateway.charge({ amount: 100, card: { ...good, expYear: 2026, expMonth: 11 } })).ok).toBe(true);
  });

  it("wants 3 digits of security code, and 4 for American Express", async () => {
    expect(await gateway.charge({ amount: 100, card: { ...good, cvc: "12" } })).toEqual({ ok: false, reason: "invalid_cvc" });
    expect(await gateway.charge({ amount: 100, card: { ...good, cvc: "1234" } })).toEqual({ ok: false, reason: "invalid_cvc" });
    expect((await gateway.charge({ amount: 100, card: { ...good, number: "378282246310005", cvc: "1234" } })).ok).toBe(true);
  });

  it("refuses the test numbers on purpose, so the shop can show what happens", async () => {
    expect(await gateway.charge({ amount: 100, card: { ...good, number: "4000000000000002" } })).toEqual({ ok: false, reason: "card_declined" });
    expect(await gateway.charge({ amount: 100, card: { ...good, number: "4000000000009995" } })).toEqual({ ok: false, reason: "insufficient_funds" });
  });

  it("gives a payment back without doing anything", async () => {
    expect(await gateway.refund("demo_abc123")).toEqual({ ok: true });
  });
});

describe("how an order moves", () => {
  it("goes paid, processing, shipped, delivered, one step at a time", () => {
    expect(canChange("paid", "processing")).toBe(true);
    expect(canChange("processing", "shipped")).toBe(true);
    expect(canChange("shipped", "delivered")).toBe(true);
    expect(canChange("paid", "shipped")).toBe(false);
    expect(canChange("paid", "delivered")).toBe(false);
  });

  it("can be cancelled until it is shipped, and never after", () => {
    expect(canChange("paid", "cancelled")).toBe(true);
    expect(canChange("processing", "cancelled")).toBe(true);
    expect(canChange("shipped", "cancelled")).toBe(false);
    expect(canChange("delivered", "cancelled")).toBe(false);
  });

  it("does not go back, and a finished order stays as it is", () => {
    expect(canChange("processing", "paid")).toBe(false);
    for (const status of orderStatuses) {
      expect(canChange("cancelled", status)).toBe(false);
      expect(canChange("delivered", status)).toBe(false);
    }
  });

  it("lists what comes next", () => {
    expect(nextStatuses("paid")).toEqual(["processing", "cancelled"]);
    expect(nextStatuses("delivered")).toEqual([]);
  });

  it("lets the customer cancel only an order that is just paid", () => {
    expect(customerCanCancel("paid")).toBe(true);
    for (const status of orderStatuses.filter((status) => status !== "paid")) expect(customerCanCancel(status)).toBe(false);
  });
});
