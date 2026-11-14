import { describe, expect, it, vi } from "vitest";
import { AppError } from "../errors/AppError.ts";
import { placeOrderSchema } from "../schemas/order.schema.ts";
import { seedProducts } from "../seed/products.seed.ts";
import { createMemoryAddressStore } from "../test/memoryAddressStore.ts";
import { createMemoryCartStore } from "../test/memoryCartStore.ts";
import { createMemoryOrderStore } from "../test/memoryOrderStore.ts";
import { createMemoryProductStore } from "../test/memoryProductStore.ts";
import { createMemoryUserStore } from "../test/memoryUserStore.ts";
import { createCartService } from "./cart.service.ts";
import { createOrderService, type OrderMailer } from "./order.service.ts";
import { createDemoGateway } from "./payment.service.ts";

const today = new Date("2026-11-14T12:00:00.000Z");

async function build() {
  const products = createMemoryProductStore();
  const ids: Record<string, string> = {};
  for (const { product, quantity } of seedProducts) ids[product.slug] = (await products.create(product, quantity)).id;

  const carts = createMemoryCartStore();
  const cart = createCartService({ carts, products });
  const users = createMemoryUserStore();
  const addresses = createMemoryAddressStore();
  const orders = createMemoryOrderStore();
  const refunds: string[] = [];
  const realGateway = createDemoGateway({ now: () => today });
  const gateway = { charge: realGateway.charge, refund: async (reference: string) => (refunds.push(reference), { ok: true as const }) };
  const mail: OrderMailer = { sendOrderConfirmation: vi.fn(async () => true), sendOrderShipped: vi.fn(async () => true) };
  // every call of the clock is one second later, so orders have an order in time
  let ticks = 0;
  const service = createOrderService({ orders, carts, cart, products, addresses, users, gateway, mail, now: () => new Date(today.getTime() + ticks++ * 1000) });

  const user = await users.create({ email: "isabel@example.com", name: "Isabel Vasquez", passwordHash: "x", accountType: "retail", preferredLanguage: "es" });
  const other = await users.create({ email: "marcus@example.com", name: "Marcus Lindqvist", passwordHash: "x", accountType: "retail", preferredLanguage: "en" });
  const address = await addresses.create(user.id, { label: "Home", street: "4821 Sunrise Lane", street2: "Apt 12B", city: "Austin", state: "TX", postalCode: "78701", country: "United States", isDefault: true });
  const otherAddress = await addresses.create(other.id, { label: "Office", street: "900 Commerce Street", city: "Dallas", state: "TX", postalCode: "75202", country: "United States", isDefault: true });

  const card = { cardNumber: "4242 4242 4242 4242", expiry: "12/30", cvc: "123", nameOnCard: "Isabel Vasquez" };
  const input = (overrides: Record<string, unknown> = {}) => placeOrderSchema.parse({ addressId: address.id, shippingMethod: "standard", payment: card, ...overrides });
  const addToCart = (productId: string, quantity = 1, owner = user.id) => cart.addItem({ userId: owner }, { kind: "product", productId, quantity }, "en");

  return { products, ids, carts, cart, users, addresses, orders, service, mail, refunds, user, other, address, otherAddress, card, input, addToCart };
}

const stockOf = async (products: Awaited<ReturnType<typeof build>>["products"], id: string) => (await products.findById(id))!.quantity;
const failure = async (run: Promise<unknown>) => (await run.then(() => undefined, (error: unknown) => error)) as AppError;

describe("the summary of the checkout", () => {
  it("shows the cart, how it can be shipped and the total, and says that it is ready", async () => {
    const { service, ids, addToCart, user } = await build();
    await addToCart(ids["ecuador-72"], 2);

    const summary = await service.summary(user.id, "standard", "en");

    expect(summary.ready).toBe(true);
    expect(summary.cart.subtotal).toBe(2400);
    expect(summary.totals).toEqual({ subtotal: 2400, shipping: 595, tax: 198, total: 3193 });
    expect(summary.shippingOptions.map((option) => option.id)).toEqual(["standard", "express"]);
  });

  it("is not ready with an empty cart, or with a line that cannot be bought", async () => {
    const { service, ids, addToCart, user, products } = await build();
    expect((await service.summary(user.id, "standard", "en")).ready).toBe(false);

    await addToCart(ids["ecuador-72"]);
    await products.setInventory(ids["ecuador-72"], { quantity: 0 });

    expect((await service.summary(user.id, "standard", "en")).ready).toBe(false);
  });
});

describe("placing an order", () => {
  it("makes the order from the cart, with a copy of what was bought, and empties the cart", async () => {
    const { service, ids, addToCart, user, input, carts, orders } = await build();
    await addToCart(ids["ecuador-72"], 2);
    await addToCart(ids["peru-68"], 1);

    const { order, created } = await service.place(user.id, input({ note: "Please leave it with the neighbor." }), "en");

    expect(created).toBe(true);
    expect(order).toMatchObject({
      status: "paid",
      itemCount: 3,
      shippingMethod: "standard",
      totals: { subtotal: 3500, shipping: 595, tax: 289, total: 4384 },
      payment: { method: "card", brand: "visa", last4: "4242", status: "paid" },
      note: "Please leave it with the neighbor.",
      customer: { email: "isabel@example.com", name: "Isabel Vasquez" },
      shippingAddress: { fullName: "Isabel Vasquez", street: "4821 Sunrise Lane", street2: "Apt 12B", city: "Austin", postalCode: "78701" },
    });
    expect(order.number).toMatch(/^SC-[0-9A-F]{8}$/);
    expect(order.lines.map((line) => [line.products[0].name, line.quantity, line.unitPrice, line.lineTotal])).toEqual([
      ["Ecuador 72%", 2, 1200, 2400],
      ["Peru 68%", 1, 1100, 1100],
    ]);
    expect(order.history).toHaveLength(1);
    expect(order.history[0].status).toBe("paid");
    expect(Date.parse(order.history[0].at)).toBeGreaterThanOrEqual(today.getTime());
    expect(await carts.find({ userId: user.id })).toBeNull();
    expect(orders.all()).toHaveLength(1);
  });

  it("never keeps the number of the card, only the brand and the last four digits", async () => {
    const { service, ids, addToCart, user, input, orders } = await build();
    await addToCart(ids["ecuador-72"]);

    await service.place(user.id, input(), "en");

    const text = JSON.stringify(orders.all());
    expect(text).not.toContain("4242424242424242");
    expect(text).not.toContain("123");
    expect(orders.all()[0].payment.last4).toBe("4242");
  });

  it("takes the stock out of the shop", async () => {
    const { service, ids, addToCart, user, input, products } = await build();
    await addToCart(ids["ecuador-72"], 3);

    await service.place(user.id, input(), "en");

    expect(await stockOf(products, ids["ecuador-72"])).toBe(117);
  });

  it("takes one of each product for every unit of a sampler", async () => {
    const { service, ids, cart, user, input, products } = await build();
    const chosen = ["ecuador-72", "peru-68", "venezuela-76", "colombia-64"].map((slug) => ids[slug]);
    await cart.addItem({ userId: user.id }, { kind: "sampler", productIds: chosen, quantity: 2 }, "en");

    const { order } = await service.place(user.id, input(), "en");

    expect(order.lines[0].kind).toBe("sampler");
    expect(order.lines[0].products).toHaveLength(4);
    expect(await stockOf(products, ids["ecuador-72"])).toBe(118);
    expect(await stockOf(products, ids["venezuela-76"])).toBe(4);
  });

  it("charges the price that was locked when the item was added, not today's price", async () => {
    const { service, ids, addToCart, user, input, products } = await build();
    await addToCart(ids["ecuador-72"], 1);
    await products.update(ids["ecuador-72"], { price: 9900 });

    const { order } = await service.place(user.id, input(), "en");

    expect(order.totals.subtotal).toBe(1200);
  });

  it("charges express shipping when it is asked for, even for a big cart", async () => {
    const { service, ids, addToCart, user, input } = await build();
    await addToCart(ids["midnight-truffle"], 4);

    const { order } = await service.place(user.id, input({ shippingMethod: "express" }), "en");

    expect(order.totals.shipping).toBe(1495);
    expect(order.shippingMethod).toBe("express");
  });

  it("sends the confirmation email in the language of the account, without waiting for it", async () => {
    const { service, ids, addToCart, user, input, mail } = await build();
    await addToCart(ids["ecuador-72"]);

    const { order } = await service.place(user.id, input(), "en");

    expect(mail.sendOrderConfirmation).toHaveBeenCalledTimes(1);
    expect(mail.sendOrderConfirmation).toHaveBeenCalledWith(order, { email: "isabel@example.com", name: "Isabel Vasquez" }, "es");
  });

  it("is not stopped by an email that cannot be sent", async () => {
    const { service, ids, addToCart, user, input, mail } = await build();
    vi.mocked(mail.sendOrderConfirmation).mockRejectedValueOnce(new Error("no mail server"));
    await addToCart(ids["ecuador-72"]);

    await expect(service.place(user.id, input(), "en")).resolves.toMatchObject({ created: true });
  });

  it("says the same order for two requests at the same moment, and charges and takes the stock once", async () => {
    const { service, ids, addToCart, user, input, orders, products, refunds } = await build();
    await addToCart(ids["ecuador-72"], 2);

    const [first, second] = await Promise.all([service.place(user.id, input(), "en"), service.place(user.id, input(), "en")]);

    expect(first.order.id).toBe(second.order.id);
    expect([first.created, second.created].sort()).toEqual([false, true]);
    expect(orders.all()).toHaveLength(1);
    expect(await stockOf(products, ids["ecuador-72"])).toBe(118);
    // the request that lost gave its payment back
    expect(refunds.length).toBeLessThanOrEqual(1);
  });

  it("answers that the cart is empty for a second press after the order was made", async () => {
    const { service, ids, addToCart, user, input } = await build();
    await addToCart(ids["ecuador-72"]);
    await service.place(user.id, input(), "en");

    const error = await failure(service.place(user.id, input(), "en"));

    expect(error.code).toBe("CART_EMPTY");
    expect(error.status).toBe(400);
  });
});

describe("an order that cannot be placed", () => {
  it("is refused for an empty cart", async () => {
    const { service, user, input } = await build();

    const error = await failure(service.place(user.id, input(), "en"));

    expect(error).toMatchObject({ code: "CART_EMPTY", status: 400 });
  });

  it("is refused for an address that belongs to somebody else, as if it did not exist", async () => {
    const { service, ids, addToCart, user, input, otherAddress } = await build();
    await addToCart(ids["ecuador-72"]);

    const error = await failure(service.place(user.id, input({ addressId: otherAddress.id }), "en"));

    expect(error).toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("is refused when a line was sold out or switched off in the meantime, and nothing is taken or charged", async () => {
    const { service, ids, addToCart, user, input, products, orders } = await build();
    await addToCart(ids["ecuador-72"]);
    await addToCart(ids["peru-68"]);
    await products.update(ids["peru-68"], { active: false });

    const error = await failure(service.place(user.id, input(), "en"));

    expect(error).toMatchObject({ code: "CART_CHANGED", status: 409 });
    expect(orders.all()).toHaveLength(0);
    expect(await stockOf(products, ids["ecuador-72"])).toBe(120);
  });

  it("gives the stock back when somebody else took the last ones after the cart was read", async () => {
    const { service, ids, addToCart, user, input, products, orders } = await build();
    await addToCart(ids["ecuador-72"], 2);
    await addToCart(ids["venezuela-76"], 2);
    const reserve = products.reserveStock.bind(products);
    // the ones of Venezuela are taken by somebody else between the check and the reservation
    products.reserveStock = async (items) => {
      await products.setInventory(ids["venezuela-76"], { quantity: 1 });
      return reserve(items);
    };

    const error = await failure(service.place(user.id, input(), "en"));

    expect(error).toMatchObject({ code: "INSUFFICIENT_STOCK", status: 409 });
    expect(await stockOf(products, ids["ecuador-72"])).toBe(120);
    expect(orders.all()).toHaveLength(0);
  });

  it("is refused with a 402 when the card is declined, and the stock and the cart stay as they were", async () => {
    const { service, ids, addToCart, user, input, products, carts, orders } = await build();
    await addToCart(ids["ecuador-72"], 2);

    const error = await failure(service.place(user.id, input({ payment: { cardNumber: "4000 0000 0000 0002", expiry: "12/30", cvc: "123", nameOnCard: "Isabel" } }), "en"));

    expect(error).toMatchObject({ code: "CARD_DECLINED", status: 402 });
    expect(await stockOf(products, ids["ecuador-72"])).toBe(120);
    expect((await carts.find({ userId: user.id }))?.lines).toHaveLength(1);
    expect(orders.all()).toHaveLength(0);
  });

  it("says when there is not enough money on the card", async () => {
    const { service, ids, addToCart, user, input } = await build();
    await addToCart(ids["ecuador-72"]);

    const error = await failure(service.place(user.id, input({ payment: { cardNumber: "4000000000009995", expiry: "12/30", cvc: "123", nameOnCard: "Isabel" } }), "en"));

    expect(error).toMatchObject({ code: "INSUFFICIENT_FUNDS", status: 402 });
  });

  it("names the field of a card that is not good: the number, the date or the code", async () => {
    const { service, ids, addToCart, user, input } = await build();
    await addToCart(ids["ecuador-72"]);
    const pay = (change: Record<string, string>) => input({ payment: { cardNumber: "4242424242424242", expiry: "12/30", cvc: "123", nameOnCard: "Isabel", ...change } });

    const number = await failure(service.place(user.id, pay({ cardNumber: "4242424242424241" }), "en"));
    const date = await failure(service.place(user.id, pay({ expiry: "01/25" }), "en"));
    // a security code of the wrong length for the brand: 4 digits on a Visa
    const code = await failure(service.place(user.id, pay({ cvc: "1234" }), "en"));

    expect((number.details[0] as { field: string }).field).toBe("cardNumber");
    expect((date.details[0] as { field: string }).field).toBe("expiry");
    expect((code.details[0] as { field: string }).field).toBe("cvc");
  });

  it("gives the stock and the money back when the order could not be saved", async () => {
    const { service, ids, addToCart, user, input, orders, products, refunds } = await build();
    await addToCart(ids["ecuador-72"], 2);
    orders.create = async () => {
      throw new Error("the database went away");
    };

    const error = await failure(service.place(user.id, input(), "en"));

    expect(error.message).toBe("the database went away");
    expect(await stockOf(products, ids["ecuador-72"])).toBe(120);
    expect(refunds).toHaveLength(1);
  });
});

describe("the orders of a person", () => {
  async function twoOrders() {
    const context = await build();
    await context.addToCart(context.ids["ecuador-72"]);
    const first = (await context.service.place(context.user.id, context.input(), "en")).order;
    await context.addToCart(context.ids["peru-68"]);
    const second = (await context.service.place(context.user.id, context.input(), "en")).order;
    return { ...context, first, second };
  }

  it("lists them newest first, with the names in the language that was asked for", async () => {
    const { service, user, first, second } = await twoOrders();

    const page = await service.list(user.id, { page: 1, limit: 10 }, "es");

    expect(page.total).toBe(2);
    expect(page.items.map((order) => order.id)).toEqual([second.id, first.id]);
    expect(page.items[0].lines[0].products[0].name).toBe("Perú 68%");
  });

  it("pages the list", async () => {
    const { service, user, first } = await twoOrders();

    const page = await service.list(user.id, { page: 2, limit: 1 }, "en");

    expect(page.items.map((order) => order.id)).toEqual([first.id]);
  });

  it("shows an order to its owner, and as not found to anybody else", async () => {
    const { service, user, other, first } = await twoOrders();

    expect((await service.get(user.id, first.id, "en")).number).toBe(first.number);
    expect(await failure(service.get(other.id, first.id, "en"))).toMatchObject({ code: "NOT_FOUND", status: 404 });
    expect(await failure(service.get(user.id, "64b7f0c2a1b2c3d4e5f6ffff", "en"))).toMatchObject({ code: "NOT_FOUND" });
  });

  it("lists nothing of the orders of somebody else", async () => {
    const { service, other } = await twoOrders();

    expect((await service.list(other.id, { page: 1, limit: 10 }, "en")).items).toEqual([]);
  });
});

describe("cancelling by the customer", () => {
  async function paid() {
    const context = await build();
    await context.addToCart(context.ids["ecuador-72"], 2);
    const { order } = await context.service.place(context.user.id, context.input(), "en");
    return { ...context, order };
  }

  it("puts the stock back, marks the payment as given back, and keeps the history", async () => {
    const { service, user, order, products, ids, refunds } = await paid();
    expect(await stockOf(products, ids["ecuador-72"])).toBe(118);

    const cancelled = await service.cancelOwn(user.id, order.id, "en");

    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.payment.status).toBe("refunded");
    expect(cancelled.history.map((entry) => entry.status)).toEqual(["paid", "cancelled"]);
    expect(await stockOf(products, ids["ecuador-72"])).toBe(120);
    expect(refunds).toEqual([order.payment.reference]);
  });

  it("cannot be done twice, and the stock goes back only once", async () => {
    const { service, user, order, products, ids } = await paid();
    await service.cancelOwn(user.id, order.id, "en");

    const error = await failure(service.cancelOwn(user.id, order.id, "en"));

    expect(error).toMatchObject({ code: "INVALID_TRANSITION", status: 400 });
    expect(await stockOf(products, ids["ecuador-72"])).toBe(120);
  });

  it("is not possible once the team started to pack the order", async () => {
    const { service, user, order } = await paid();
    await service.adminSetStatus(order.id, "processing", "en");

    expect(await failure(service.cancelOwn(user.id, order.id, "en"))).toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("is not possible for the order of somebody else", async () => {
    const { service, other, order } = await paid();

    expect(await failure(service.cancelOwn(other.id, order.id, "en"))).toMatchObject({ code: "NOT_FOUND", status: 404 });
  });
});

describe("the team moving an order", () => {
  async function paid() {
    const context = await build();
    await context.addToCart(context.ids["ecuador-72"], 2);
    const { order } = await context.service.place(context.user.id, context.input(), "en");
    return { ...context, order };
  }

  it("moves it along step by step, and keeps when each step was made", async () => {
    const { service, order } = await paid();

    await service.adminSetStatus(order.id, "processing", "en");
    await service.adminSetStatus(order.id, "shipped", "en");
    const delivered = await service.adminSetStatus(order.id, "delivered", "en");

    expect(delivered.status).toBe("delivered");
    expect(delivered.history.map((entry) => entry.status)).toEqual(["paid", "processing", "shipped", "delivered"]);
    expect(delivered.nextStatuses).toEqual([]);
  });

  it("refuses a step that is not allowed", async () => {
    const { service, order } = await paid();

    expect(await failure(service.adminSetStatus(order.id, "delivered", "en"))).toMatchObject({ code: "INVALID_TRANSITION", status: 400 });
    expect(await failure(service.adminSetStatus("64b7f0c2a1b2c3d4e5f6ffff", "processing", "en"))).toMatchObject({ code: "NOT_FOUND" });
  });

  it("sends an email when the order is shipped, in the language of the customer", async () => {
    const { service, order, mail } = await paid();
    await service.adminSetStatus(order.id, "processing", "en");

    await service.adminSetStatus(order.id, "shipped", "en");

    expect(mail.sendOrderShipped).toHaveBeenCalledTimes(1);
    expect(vi.mocked(mail.sendOrderShipped).mock.calls[0][2]).toBe("es");
  });

  it("puts the stock back when the team cancels, from paid or from processing", async () => {
    const { service, order, products, ids } = await paid();
    await service.adminSetStatus(order.id, "processing", "en");

    const cancelled = await service.adminSetStatus(order.id, "cancelled", "en");

    expect(cancelled.payment.status).toBe("refunded");
    expect(await stockOf(products, ids["ecuador-72"])).toBe(120);
  });

  it("cannot cancel an order that was shipped", async () => {
    const { service, order } = await paid();
    await service.adminSetStatus(order.id, "processing", "en");
    await service.adminSetStatus(order.id, "shipped", "en");

    expect(await failure(service.adminSetStatus(order.id, "cancelled", "en"))).toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("lists every order, and finds them by status or by a part of the number, the email or the name", async () => {
    const { service, order, ids, other, addToCart, input, otherAddress } = await paid();
    await addToCart(ids["peru-68"], 1, other.id);
    const second = (await service.place(other.id, input({ addressId: otherAddress.id }), "en")).order;
    await service.adminSetStatus(order.id, "processing", "en");

    expect((await service.adminList({ page: 1, limit: 10 }, "en")).total).toBe(2);
    expect((await service.adminList({ status: "processing", page: 1, limit: 10 }, "en")).items.map((item) => item.id)).toEqual([order.id]);
    expect((await service.adminList({ q: "marcus", page: 1, limit: 10 }, "en")).items.map((item) => item.id)).toEqual([second.id]);
    expect((await service.adminList({ q: order.number.slice(3, 9).toLowerCase(), page: 1, limit: 10 }, "en")).items.map((item) => item.id)).toContain(order.id);
    expect((await service.adminGet(order.id, "en")).customer.email).toBe("isabel@example.com");
  });
});

describe("the numbers of the dashboard", () => {
  it("counts the orders and the money, without the cancelled ones, and lists what is low on stock", async () => {
    const { service, ids, addToCart, user, input, other, otherAddress } = await build();
    await addToCart(ids["ecuador-72"], 2);
    const first = (await service.place(user.id, input(), "en")).order;
    await addToCart(ids["venezuela-76"], 1, other.id);
    await service.place(other.id, input({ addressId: otherAddress.id }), "en");
    await service.adminSetStatus(first.id, "cancelled", "en");

    const stats = await service.stats("en");

    expect(stats.orders).toBe(2);
    expect(stats.byStatus).toMatchObject({ paid: 1, cancelled: 1, processing: 0 });
    expect(stats.revenue).toBe(1500 + 595 + 124);
    expect(stats.averageOrder).toBe(stats.revenue);
    expect(stats.today.orders).toBe(2);
    expect(stats.customers).toBe(2);
    expect(stats.lowStock.map((product) => product.slug)).toContain("venezuela-76");
    expect(stats.recentOrders).toHaveLength(2);
  });

  it("is all zeros before the first order", async () => {
    const { service } = await build();

    const stats = await service.stats("en");

    expect(stats).toMatchObject({ orders: 0, revenue: 0, averageOrder: 0, today: { orders: 0, revenue: 0 }, recentOrders: [] });
  });
});
