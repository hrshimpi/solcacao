import express from "express";
import { pino } from "pino";
import { pinoHttp } from "pino-http";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { signToken } from "../middleware/auth.ts";
import { errorHandler } from "../middleware/errorHandler.ts";
import { detectLanguage } from "../middleware/language.ts";
import { seedProducts } from "../seed/products.seed.ts";
import { createCartService } from "../services/cart.service.ts";
import { createOrderService } from "../services/order.service.ts";
import { createDemoGateway } from "../services/payment.service.ts";
import { createMemoryAddressStore } from "../test/memoryAddressStore.ts";
import { createMemoryCartStore } from "../test/memoryCartStore.ts";
import { createMemoryOrderStore } from "../test/memoryOrderStore.ts";
import { createMemoryProductStore } from "../test/memoryProductStore.ts";
import { createMemoryUserStore } from "../test/memoryUserStore.ts";
import { createAdminRouter } from "./admin.routes.ts";
import { createOrdersRouter, ordersLimiter } from "./orders.routes.ts";

async function build(options: { limit?: number } = {}) {
  const products = createMemoryProductStore();
  const ids: Record<string, string> = {};
  for (const { product, quantity } of seedProducts) ids[product.slug] = (await products.create(product, quantity)).id;
  const carts = createMemoryCartStore();
  const cart = createCartService({ carts, products });
  const users = createMemoryUserStore();
  const addresses = createMemoryAddressStore();
  const orders = createMemoryOrderStore();
  const service = createOrderService({ orders, carts, cart, products, addresses, users, gateway: createDemoGateway({ now: () => new Date("2026-11-14T12:00:00.000Z") }) });

  const user = await users.create({ email: "isabel@example.com", name: "Isabel Vasquez", passwordHash: "x", accountType: "retail", preferredLanguage: "en" });
  const other = await users.create({ email: "marcus@example.com", name: "Marcus Lindqvist", passwordHash: "x", accountType: "b2b", preferredLanguage: "en" });
  const admin = await users.create({ email: "admin@example.com", name: "Demo Admin", passwordHash: "x", accountType: "retail", preferredLanguage: "en", role: "admin" });
  const address = await addresses.create(user.id, { label: "Home", street: "4821 Sunrise Lane", city: "Austin", state: "TX", postalCode: "78701", country: "United States", isDefault: true });
  const otherAddress = await addresses.create(other.id, { label: "Office", street: "900 Commerce Street", city: "Dallas", state: "TX", postalCode: "75202", country: "United States", isDefault: true });

  const app = express();
  app.use(pinoHttp({ logger: pino({ level: "silent" }) }));
  app.use(express.json({ limit: "100kb" }));
  app.use(detectLanguage);
  app.use("/api", createOrdersRouter({ service, limiter: ordersLimiter({ limit: options.limit ?? 50 }) }));
  app.use("/api/admin", createAdminRouter({ service }));
  app.use(errorHandler);

  const tokens = {
    user: await signToken({ id: user.id, role: "user", accountType: "retail" }),
    other: await signToken({ id: other.id, role: "user", accountType: "b2b" }),
    admin: await signToken({ id: admin.id, role: "admin", accountType: "retail" }),
  };
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const addToCart = (token: string, owner: string, productId: string, quantity = 1) => cart.addItem({ userId: owner }, { kind: "product", productId, quantity }, "en").then(() => token);

  const body = (overrides: Record<string, unknown> = {}) => ({
    addressId: address.id,
    shippingMethod: "standard",
    payment: { cardNumber: "4242 4242 4242 4242", expiry: "12/30", cvc: "123", nameOnCard: "Isabel Vasquez" },
    ...overrides,
  });

  return { app, ids, products, carts, orders, user, other, address, otherAddress, tokens, as, addToCart, body, cart };
}

describe("GET /api/checkout", () => {
  it("shows the cart, the ways to ship and the totals that the server worked out, and is not kept by a cache", async () => {
    const { app, ids, user, tokens, as, addToCart } = await build();
    await addToCart(tokens.user, user.id, ids["ecuador-72"], 2);

    const res = await request(app).get("/api/checkout?shipping=express").set(as(tokens.user));

    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body).toMatchObject({ ready: true, shipping: "express", totals: { subtotal: 2400, shipping: 1495, tax: 198, total: 4093 } });
    expect(res.body.shippingOptions).toHaveLength(2);
    expect(res.body.cart.lines).toHaveLength(1);
  });

  it("refuses a way of shipping that does not exist", async () => {
    const { app, tokens, as } = await build();

    const res = await request(app).get("/api/checkout?shipping=teleport").set(as(tokens.user));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("is for a signed in person", async () => {
    const { app } = await build();

    expect((await request(app).get("/api/checkout")).status).toBe(401);
  });
});

describe("POST /api/orders", () => {
  it("makes the order of the cart: 201, the order with its number, and no number of the card anywhere in the answer", async () => {
    const { app, ids, user, tokens, as, addToCart, body } = await build();
    await addToCart(tokens.user, user.id, ids["ecuador-72"], 2);

    const res = await request(app).post("/api/orders").set(as(tokens.user)).send(body({ note: "Ring the bell." }));

    expect(res.status).toBe(201);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body.order).toMatchObject({ status: "paid", totals: { total: 3193 }, payment: { brand: "visa", last4: "4242" }, note: "Ring the bell." });
    expect(res.body.order.number).toMatch(/^SC-[0-9A-F]{8}$/);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain("4242424242424242");
    expect(text).not.toContain("cartKey");
  });

  it("answers the names in the language of the request", async () => {
    const { app, ids, user, tokens, as, addToCart, body } = await build();
    await addToCart(tokens.user, user.id, ids["peru-68"]);

    const res = await request(app).post("/api/orders").set(as(tokens.user)).set("Accept-Language", "es").send(body());

    expect(res.body.order.lines[0].products[0].name).toBe("Perú 68%");
  });

  it("empties the cart, and the next try says that the cart is empty", async () => {
    const { app, ids, user, tokens, as, addToCart, body, carts } = await build();
    await addToCart(tokens.user, user.id, ids["ecuador-72"]);
    await request(app).post("/api/orders").set(as(tokens.user)).send(body());

    const again = await request(app).post("/api/orders").set(as(tokens.user)).send(body());

    expect(await carts.find({ userId: user.id })).toBeNull();
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe("CART_EMPTY");
  });

  it("is refused with a 402 for a card that is declined, in the standard error shape with the field", async () => {
    const { app, ids, user, tokens, as, addToCart, body, orders } = await build();
    await addToCart(tokens.user, user.id, ids["ecuador-72"]);

    const res = await request(app).post("/api/orders").set(as(tokens.user)).send(body({ payment: { cardNumber: "4000 0000 0000 0002", expiry: "12/30", cvc: "123", nameOnCard: "Isabel" } }));

    expect(res.status).toBe(402);
    expect(res.body.error).toMatchObject({ code: "CARD_DECLINED", details: [{ field: "cardNumber" }] });
    expect(orders.all()).toHaveLength(0);
  });

  it("names each field of the body that is wrong", async () => {
    const { app, tokens, as, body } = await build();

    const res = await request(app)
      .post("/api/orders")
      .set(as(tokens.user))
      .send(body({ addressId: "nope", shippingMethod: "teleport", payment: { cardNumber: "12", expiry: "13/99", cvc: "1", nameOnCard: "" } }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    const fields = res.body.error.details.map((detail: { field: string }) => detail.field);
    expect(fields).toEqual(expect.arrayContaining(["addressId", "shippingMethod", "payment.cardNumber", "payment.expiry", "payment.cvc", "payment.nameOnCard"]));
  });

  it("refuses a price, a total or any other field that a client should not send (mass assignment)", async () => {
    const { app, ids, user, tokens, as, addToCart, body } = await build();
    await addToCart(tokens.user, user.id, ids["ecuador-72"]);

    for (const extra of [{ total: 1 }, { subtotal: 1 }, { status: "delivered" }, { userId: user.id }, { shippingTotal: 0 }, { lines: [] }]) {
      const res = await request(app).post("/api/orders").set(as(tokens.user)).send(body(extra));
      expect(res.status, JSON.stringify(extra)).toBe(400);
    }
    expect((await request(app).post("/api/orders").set(as(tokens.user)).send(body({ payment: { cardNumber: "4242424242424242", expiry: "12/30", cvc: "123", nameOnCard: "I", amount: 1 } }))).status).toBe(400);
  });

  it("refuses the address of somebody else with a 404", async () => {
    const { app, ids, user, tokens, as, addToCart, body, otherAddress } = await build();
    await addToCart(tokens.user, user.id, ids["ecuador-72"]);

    const res = await request(app).post("/api/orders").set(as(tokens.user)).send(body({ addressId: otherAddress.id }));

    expect(res.status).toBe(404);
  });

  it("is limited for each person, with a 429", async () => {
    const { app, tokens, as, body } = await build({ limit: 2 });

    for (let attempt = 0; attempt < 2; attempt++) await request(app).post("/api/orders").set(as(tokens.user)).send(body());
    const res = await request(app).post("/api/orders").set(as(tokens.user)).send(body());

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("RATE_LIMITED");
  });

  it("is for a signed in person", async () => {
    const { app, body } = await build();

    expect((await request(app).post("/api/orders").send(body())).status).toBe(401);
  });
});

describe("the orders of a person", () => {
  async function withOrder() {
    const context = await build();
    await context.addToCart(context.tokens.user, context.user.id, context.ids["ecuador-72"], 2);
    const placed = await request(context.app).post("/api/orders").set(context.as(context.tokens.user)).send(context.body());
    return { ...context, order: placed.body.order as { id: string; number: string } };
  }

  it("lists them, and shows one", async () => {
    const { app, tokens, as, order } = await withOrder();

    const list = await request(app).get("/api/orders").set(as(tokens.user));
    const one = await request(app).get(`/api/orders/${order.id}`).set(as(tokens.user));

    expect(list.status).toBe(200);
    expect(list.body).toMatchObject({ page: 1, limit: 20, total: 1 });
    expect(list.body.items[0].number).toBe(order.number);
    expect(one.body.order.number).toBe(order.number);
  });

  it("shows nothing of the orders of somebody else: a 404 for one order and an empty list", async () => {
    const { app, tokens, as, order } = await withOrder();

    const one = await request(app).get(`/api/orders/${order.id}`).set(as(tokens.other));
    const list = await request(app).get("/api/orders").set(as(tokens.other));
    const cancel = await request(app).post(`/api/orders/${order.id}/cancel`).set(as(tokens.other));

    expect(one.status).toBe(404);
    expect(list.body.items).toEqual([]);
    expect(cancel.status).toBe(404);
  });

  it("refuses an id that cannot be an order, and a page size that is too big", async () => {
    const { app, tokens, as } = await withOrder();

    expect((await request(app).get("/api/orders/not-an-id").set(as(tokens.user))).status).toBe(400);
    expect((await request(app).get("/api/orders?limit=500").set(as(tokens.user))).status).toBe(400);
    expect((await request(app).get("/api/orders?page=0").set(as(tokens.user))).status).toBe(400);
  });

  it("cancels an order that was just paid, and then it cannot be cancelled again", async () => {
    const { app, tokens, as, order } = await withOrder();

    const first = await request(app).post(`/api/orders/${order.id}/cancel`).set(as(tokens.user));
    const second = await request(app).post(`/api/orders/${order.id}/cancel`).set(as(tokens.user));

    expect(first.status).toBe(200);
    expect(first.body.order).toMatchObject({ status: "cancelled", payment: { status: "refunded" } });
    expect(second.status).toBe(400);
    expect(second.body.error.code).toBe("INVALID_TRANSITION");
  });
});

describe("the admin routes", () => {
  async function withOrder() {
    const context = await build();
    await context.addToCart(context.tokens.user, context.user.id, context.ids["ecuador-72"], 2);
    const placed = await request(context.app).post("/api/orders").set(context.as(context.tokens.user)).send(context.body());
    return { ...context, order: placed.body.order as { id: string; number: string } };
  }

  it("show the numbers of the dashboard to an admin", async () => {
    const { app, tokens, as } = await withOrder();

    const res = await request(app).get("/api/admin/stats").set(as(tokens.admin));

    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body).toMatchObject({ orders: 1, revenue: 3193, customers: 3, byStatus: { paid: 1 } });
    expect(res.body.recentOrders).toHaveLength(1);
  });

  it("list and show every order, with the customer", async () => {
    const { app, tokens, as, order } = await withOrder();

    const list = await request(app).get("/api/admin/orders?status=paid&q=isabel").set(as(tokens.admin));
    const one = await request(app).get(`/api/admin/orders/${order.id}`).set(as(tokens.admin));

    expect(list.body.total).toBe(1);
    expect(one.body.order.customer).toMatchObject({ email: "isabel@example.com", name: "Isabel Vasquez" });
  });

  it("move an order along, and refuse a step that is not allowed or a status that does not exist", async () => {
    const { app, tokens, as, order } = await withOrder();

    const processing = await request(app).patch(`/api/admin/orders/${order.id}`).set(as(tokens.admin)).send({ status: "processing" });
    const skip = await request(app).patch(`/api/admin/orders/${order.id}`).set(as(tokens.admin)).send({ status: "delivered" });
    const nonsense = await request(app).patch(`/api/admin/orders/${order.id}`).set(as(tokens.admin)).send({ status: "teleported" });
    const extra = await request(app).patch(`/api/admin/orders/${order.id}`).set(as(tokens.admin)).send({ status: "shipped", total: 1 });

    expect(processing.body.order).toMatchObject({ status: "processing", nextStatuses: ["shipped", "cancelled"] });
    expect(skip.status).toBe(400);
    expect(skip.body.error.code).toBe("INVALID_TRANSITION");
    expect(nonsense.status).toBe(400);
    expect(extra.status).toBe(400);
  });

  it("are closed to everybody who is not an admin: 401 without a token, 403 for a customer", async () => {
    const { app, tokens, as, order } = await withOrder();

    for (const path of ["/api/admin/stats", "/api/admin/orders", `/api/admin/orders/${order.id}`]) {
      expect((await request(app).get(path)).status, path).toBe(401);
      expect((await request(app).get(path).set(as(tokens.user))).status, path).toBe(403);
      expect((await request(app).get(path).set(as(tokens.other))).status, path).toBe(403);
    }
    expect((await request(app).patch(`/api/admin/orders/${order.id}`).set(as(tokens.user)).send({ status: "processing" })).status).toBe(403);
  });
});
