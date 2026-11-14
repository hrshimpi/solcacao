import { describe, expect, it } from "vitest";
import { adminOrderListQuerySchema, orderListQuerySchema, orderStatusBodySchema, placeOrderSchema, summaryQuerySchema } from "./order.schema.ts";

const address = "64b7f0c2a1b2c3d4e5f60718";
const good = { addressId: address, shippingMethod: "standard", payment: { cardNumber: "4242 4242-4242 4242", expiry: "12/30", cvc: "123", nameOnCard: "Isabel Vasquez" } };

describe("the body that places an order", () => {
  it("takes a good one, cleans the card number and reads the expiry date", () => {
    const parsed = placeOrderSchema.parse(good);

    expect(parsed.payment.cardNumber).toBe("4242424242424242");
    expect(parsed.payment.expiry).toEqual({ expMonth: 12, expYear: 2030 });
    expect(parsed.addressId).toBe(address);
  });

  it("reads the expiry date with a four digit year and with spaces", () => {
    expect(placeOrderSchema.parse({ ...good, payment: { ...good.payment, expiry: "01 / 2031" } }).payment.expiry).toEqual({ expMonth: 1, expYear: 2031 });
  });

  it("lower cases the id of the address, and takes a note without tags", () => {
    const parsed = placeOrderSchema.parse({ ...good, addressId: address.toUpperCase(), note: "Leave it <b>at</b> the door" });

    expect(parsed.addressId).toBe(address);
    expect(parsed.note).toBe("Leave it at the door");
  });

  it("refuses what is wrong, with a message for each field", () => {
    const result = placeOrderSchema.safeParse({ addressId: "x", shippingMethod: "teleport", payment: { cardNumber: "12", expiry: "13/30", cvc: "9", nameOnCard: "" } });

    expect(result.success).toBe(false);
    const paths = result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["addressId", "shippingMethod", "payment.cardNumber", "payment.expiry", "payment.cvc", "payment.nameOnCard"]));
  });

  it("refuses fields that a client must not send, at the top and inside the payment", () => {
    for (const extra of [{ total: 1 }, { status: "delivered" }, { userId: address }, { lines: [] }, { shippingTotal: 0 }]) {
      expect(placeOrderSchema.safeParse({ ...good, ...extra }).success, JSON.stringify(extra)).toBe(false);
    }
    expect(placeOrderSchema.safeParse({ ...good, payment: { ...good.payment, amount: 1 } }).success).toBe(false);
  });

  it("refuses a note that is too long, and a missing address or payment", () => {
    expect(placeOrderSchema.safeParse({ ...good, note: "x".repeat(301) }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ shippingMethod: "standard", payment: good.payment }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ addressId: address, shippingMethod: "standard" }).success).toBe(false);
  });
});

describe("the filters of the lists", () => {
  it("uses standard shipping when none is asked for", () => {
    expect(summaryQuerySchema.parse({}).shipping).toBe("standard");
    expect(summaryQuerySchema.safeParse({ shipping: "teleport" }).success).toBe(false);
  });

  it("gives the lists a page and a limit, and keeps the limit of a person at 50", () => {
    expect(orderListQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(orderListQuerySchema.safeParse({ limit: "51" }).success).toBe(false);
    expect(adminOrderListQuerySchema.parse({ status: "paid", q: "  isabel ", limit: "100" })).toMatchObject({ status: "paid", q: "isabel", limit: 100 });
    expect(adminOrderListQuerySchema.safeParse({ status: "lost" }).success).toBe(false);
  });

  it("takes only a status for the change of the team", () => {
    expect(orderStatusBodySchema.parse({ status: "shipped" })).toEqual({ status: "shipped" });
    expect(orderStatusBodySchema.safeParse({ status: "shipped", total: 0 }).success).toBe(false);
    expect(orderStatusBodySchema.safeParse({}).success).toBe(false);
  });
});
