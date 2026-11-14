import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Order } from "../models/order.model.ts";
import { createMemoryOrderStore } from "../test/memoryOrderStore.ts";
import { createMongoOrderStore, type NewOrder, type OrderStore } from "./order.store.ts";

const userA = "64b7f0c2a1b2c3d4e5f60718";
const userB = "64b7f0c2a1b2c3d4e5f60719";
const productId = "64b7f0c2a1b2c3d4e5f60a01";

function newOrder(overrides: Partial<NewOrder> = {}): NewOrder {
  return {
    userId: userA,
    email: "isabel@example.com",
    customerName: "Isabel Vasquez",
    status: "paid",
    lines: [
      {
        kind: "product",
        products: [{ productId, slug: "ecuador-72", name: { en: "Ecuador 72%", es: "Ecuador 72%" }, thumbnail: "https://images.example.com/a.jpg", imageAlt: { en: "A bar", es: "Una barra" } }],
        quantity: 2,
        unitPrice: 1200,
        lineTotal: 2400,
      },
    ],
    shippingAddress: { fullName: "Isabel Vasquez", phone: "+1 512 555 0184", label: "Home", street: "4821 Sunrise Lane", street2: null, city: "Austin", state: "TX", postalCode: "78701", country: "United States" },
    shippingMethod: "standard",
    subtotal: 2400,
    shippingTotal: 595,
    taxTotal: 198,
    total: 3193,
    payment: { method: "card", brand: "visa", last4: "4242", reference: "demo_abc", status: "paid" },
    note: null,
    history: [{ status: "paid", at: "2026-11-14T12:00:00.000Z" }],
    cartKey: `${userA}:1:2026-11-14T11:59:00.000Z`,
    ...overrides,
  };
}

// a different cart each time, and a different moment for each order
let counter = 0;
const another = (overrides: Partial<NewOrder> = {}) => {
  counter += 1;
  const minute = String(counter % 60).padStart(2, "0");
  return newOrder({ cartKey: `${overrides.userId ?? userA}:${counter}:2026-11-14T12:${minute}:00.000Z`, history: [{ status: "paid", at: `2026-11-14T12:${minute}:00.000Z` }], ...overrides });
};

// The same rules are checked on both stores: the one in memory (always) and the one for MongoDB
// (only when MONGODB_TEST_URI is set, see the readme).
function storeContract(makeStore: () => OrderStore | Promise<OrderStore>) {
  let store: OrderStore;

  beforeEach(async () => {
    store = await makeStore();
  });

  it("saves an order with its number, the copy of what was bought, and the same values when it is read again", async () => {
    const saved = (await store.create(newOrder()))!;

    expect(saved.number).toBe(`SC-${saved.id.slice(-8).toUpperCase()}`);
    expect(saved).toMatchObject({ userId: userA, status: "paid", total: 3193, note: null, payment: { last4: "4242", status: "paid" } });
    expect(saved.lines[0].products[0].name).toEqual({ en: "Ecuador 72%", es: "Ecuador 72%" });
    expect(saved.shippingAddress).toMatchObject({ street: "4821 Sunrise Lane", street2: null, phone: "+1 512 555 0184" });
    expect(await store.findById(saved.id)).toEqual(saved);
  });

  it("answers null when the same cart already made an order, and keeps the first one", async () => {
    const first = (await store.create(newOrder()))!;

    expect(await store.create(newOrder())).toBeNull();
    expect((await store.findByCartKey(first.cartKey))?.id).toBe(first.id);
    expect(await store.findByCartKey("nobody:1:never")).toBeNull();
  });

  it("finds an order for its owner only", async () => {
    const saved = (await store.create(another()))!;

    expect((await store.findOwned(userA, saved.id))?.id).toBe(saved.id);
    expect(await store.findOwned(userB, saved.id)).toBeNull();
    expect(await store.findOwned(userA, "64b7f0c2a1b2c3d4e5f6ffff")).toBeNull();
    expect(await store.findOwned(userA, "not-an-id")).toBeNull();
    expect(await store.findById("not-an-id")).toBeNull();
  });

  it("lists the orders of a user newest first, in pages, and nobody else's", async () => {
    const first = (await store.create(another()))!;
    const second = (await store.create(another()))!;
    const third = (await store.create(another()))!;
    await store.create(another({ userId: userB }));

    const all = await store.listForUser(userA, { page: 1, limit: 10 });
    expect(all.total).toBe(3);
    expect(all.items.map((order) => order.id)).toEqual([third.id, second.id, first.id]);

    const secondPage = await store.listForUser(userA, { page: 2, limit: 2 });
    expect(secondPage.items.map((order) => order.id)).toEqual([first.id]);
    expect(secondPage.total).toBe(3);
    expect((await store.listForUser("not-an-id", { page: 1, limit: 10 })).items).toEqual([]);
  });

  it("lists every order for the team, filtered by status and by a part of the number, the email or the name", async () => {
    const one = (await store.create(another()))!;
    const two = (await store.create(another({ userId: userB, email: "marcus@haciendabrands.example", customerName: "Marcus Lindqvist" })))!;
    await store.transition(one.id, ["paid"], "processing", new Date("2026-11-14T13:00:00.000Z"));

    expect((await store.list({ page: 1, limit: 10 })).total).toBe(2);
    expect((await store.list({ status: "processing", page: 1, limit: 10 })).items.map((order) => order.id)).toEqual([one.id]);
    expect((await store.list({ q: "MARCUS", page: 1, limit: 10 })).items.map((order) => order.id)).toEqual([two.id]);
    expect((await store.list({ q: "haciendabrands", page: 1, limit: 10 })).items.map((order) => order.id)).toEqual([two.id]);
    expect((await store.list({ q: one.number.toLowerCase(), page: 1, limit: 10 })).items.map((order) => order.id)).toEqual([one.id]);
    expect((await store.list({ q: "nothing like this", page: 1, limit: 10 })).total).toBe(0);
  });

  it("treats a search as text, not as a pattern", async () => {
    await store.create(another());

    expect((await store.list({ q: ".*", page: 1, limit: 10 })).total).toBe(0);
    expect((await store.list({ q: "(", page: 1, limit: 10 })).total).toBe(0);
  });

  it("moves an order to a new status and writes down when, only from a status that is allowed", async () => {
    const saved = (await store.create(another()))!;

    const moved = await store.transition(saved.id, ["paid"], "processing", new Date("2026-11-14T13:00:00.000Z"));

    expect(moved?.status).toBe("processing");
    expect(moved?.history.map((entry) => entry.status)).toEqual(["paid", "processing"]);
    expect(moved?.history[1].at).toBe("2026-11-14T13:00:00.000Z");
    // it is not paid any more: the same step again changes nothing
    expect(await store.transition(saved.id, ["paid"], "processing", new Date())).toBeNull();
    expect((await store.findById(saved.id))?.history).toHaveLength(2);
  });

  it("marks the payment as given back together with a cancellation", async () => {
    const saved = (await store.create(another()))!;

    const cancelled = await store.transition(saved.id, ["paid", "processing"], "cancelled", new Date(), { paymentStatus: "refunded" });

    expect(cancelled).toMatchObject({ status: "cancelled", payment: { status: "refunded" } });
  });

  it("answers null for a transition of an order that does not exist", async () => {
    expect(await store.transition("64b7f0c2a1b2c3d4e5f6ffff", ["paid"], "processing", new Date())).toBeNull();
    expect(await store.transition("not-an-id", ["paid"], "processing", new Date())).toBeNull();
  });

  it("counts the orders, the money without the cancelled ones, and what was made since a moment", async () => {
    const early = (await store.create(another({ history: [{ status: "paid", at: "2026-11-13T09:00:00.000Z" }] })))!;
    await store.create(another({ total: 1000 }));
    const cancelled = (await store.create(another({ total: 500 })))!;
    await store.transition(cancelled.id, ["paid"], "cancelled", new Date());
    expect(early.createdAt).toBeTruthy();

    const stats = await store.stats(new Date("2026-11-14T00:00:00.000Z"));

    expect(stats.orders).toBe(3);
    expect(stats.revenue).toBe(3193 + 1000);
    expect(stats.byStatus).toEqual({ paid: 2, processing: 0, shipped: 0, delivered: 0, cancelled: 1 });
    expect(stats.today).toEqual({ orders: 2, revenue: 1000 });
  });

  it("starts from zeros", async () => {
    expect(await store.stats(new Date())).toEqual({ orders: 0, revenue: 0, byStatus: { paid: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 }, today: { orders: 0, revenue: 0 } });
  });
}

describe("order store in memory", () => {
  storeContract(() => createMemoryOrderStore());
});

const mongoUri = process.env.MONGODB_TEST_URI;

describe.skipIf(!mongoUri)("order store on MongoDB", () => {
  beforeAll(async () => {
    await mongoose.connect(mongoUri as string);
    await Order.init();
  });
  afterAll(async () => {
    await Order.deleteMany({});
    await mongoose.disconnect();
  });

  storeContract(async () => {
    await Order.deleteMany({});
    return createMongoOrderStore();
  });
});
