import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Cart } from "../models/cart.model.ts";
import { createMemoryCartStore } from "../test/memoryCartStore.ts";
import { createMongoCartStore, type CartOwner, type CartStore, type StoredCartLine } from "./cart.store.ts";

const user: CartOwner = { userId: "64b7f0c2a1b2c3d4e5f60718" };
const otherUser: CartOwner = { userId: "64b7f0c2a1b2c3d4e5f60719" };
const guest: CartOwner = { guestId: "6f1d2c3b-4a59-4e8b-9c7d-0a1b2c3d4e5f" };

const peruId = "64b7f0c2a1b2c3d4e5f60a01";
const ecuadorId = "64b7f0c2a1b2c3d4e5f60a02";
const peruLine: StoredCartLine = { lineId: `p-${peruId}`, kind: "product", productIds: [peruId], quantity: 2, unitPrice: 1100 };
const ecuadorLine: StoredCartLine = { lineId: `p-${ecuadorId}`, kind: "product", productIds: [ecuadorId], quantity: 1, unitPrice: 1200 };
const sampler: StoredCartLine = { lineId: "s-0123456789abcdef0123", kind: "sampler", productIds: [peruId, ecuadorId, "64b7f0c2a1b2c3d4e5f60a03", "64b7f0c2a1b2c3d4e5f60a04"], quantity: 1, unitPrice: 4300 };
const inThirtyDays = new Date("2026-04-01T00:00:00.000Z");

// The same rules are checked on both stores: the one in memory (always) and the one for MongoDB
// (only when MONGODB_TEST_URI is set, see the readme).
function storeContract(makeStore: () => CartStore | Promise<CartStore>) {
  let store: CartStore;

  beforeEach(async () => {
    store = await makeStore();
  });

  it("has no cart for an owner that never made one", async () => {
    expect(await store.find(user)).toBeNull();
    expect(await store.find(guest)).toBeNull();
  });

  it("saves a new cart as version 1, and finds it again with the same lines", async () => {
    const saved = await store.save(user, [peruLine, sampler], null);

    expect(saved).toMatchObject({ version: 1, lines: [peruLine, sampler] });
    expect(await store.find(user)).toEqual(saved);
    expect(Number.isNaN(Date.parse(saved!.updatedAt))).toBe(false);
  });

  it("keeps the order of the lines and of the products of a sampler", async () => {
    await store.save(user, [sampler, ecuadorLine, peruLine], null);

    const found = await store.find(user);

    expect(found?.lines.map((line) => line.lineId)).toEqual([sampler.lineId, ecuadorLine.lineId, peruLine.lineId]);
    expect(found?.lines[0].productIds).toEqual(sampler.productIds);
  });

  it("saves again when the version is the one that was read, and counts the change", async () => {
    const first = (await store.save(user, [peruLine], null))!;

    const second = await store.save(user, [peruLine, ecuadorLine], first.version);

    expect(second).toMatchObject({ version: 2, lines: [peruLine, ecuadorLine] });
  });

  it("refuses a save made on an old version, and leaves the cart as it is", async () => {
    const first = (await store.save(user, [peruLine], null))!;
    await store.save(user, [peruLine, ecuadorLine], first.version);

    expect(await store.save(user, [], first.version)).toBeNull();

    expect((await store.find(user))?.lines).toHaveLength(2);
  });

  it("lets only one of two saves of the same version win", async () => {
    const first = (await store.save(user, [peruLine], null))!;

    const results = await Promise.all([store.save(user, [ecuadorLine], first.version), store.save(user, [sampler], first.version)]);

    expect(results.filter((result) => result !== null)).toHaveLength(1);
    expect((await store.find(user))?.version).toBe(2);
  });

  it("lets only one of two first saves for the same owner win", async () => {
    const results = await Promise.all([store.save(user, [peruLine], null), store.save(user, [ecuadorLine], null)]);

    expect(results.filter((result) => result !== null)).toHaveLength(1);
  });

  it("refuses to make a cart that was made a moment ago", async () => {
    await store.save(user, [peruLine], null);

    expect(await store.save(user, [ecuadorLine], null)).toBeNull();
  });

  it("refuses a save for a cart that is not there", async () => {
    expect(await store.save(user, [peruLine], 3)).toBeNull();
  });

  it("keeps the cart of each owner apart, a user and a visitor too", async () => {
    await store.save(user, [peruLine], null);
    await store.save(otherUser, [ecuadorLine], null);
    await store.save(guest, [sampler], null, inThirtyDays);

    expect((await store.find(user))?.lines).toEqual([peruLine]);
    expect((await store.find(otherUser))?.lines).toEqual([ecuadorLine]);
    expect((await store.find(guest))?.lines).toEqual([sampler]);
  });

  it("can save an empty cart", async () => {
    const saved = (await store.save(user, [peruLine], null))!;

    expect(await store.save(user, [], saved.version)).toMatchObject({ lines: [], version: 2 });
  });

  it("removes a cart, and does not mind one that is not there", async () => {
    await store.save(user, [peruLine], null);

    await store.remove(user);
    await store.remove(otherUser);

    expect(await store.find(user)).toBeNull();
    // a new one can be made
    expect(await store.save(user, [ecuadorLine], null)).toMatchObject({ version: 1 });
  });

  it("has no cart for an owner that cannot be real, and makes none", async () => {
    for (const owner of [{ userId: "not an id" }, { guestId: "x" }, { guestId: "has spaces in it!" }, { userId: '{"$ne": null}' }] as CartOwner[]) {
      expect(await store.find(owner)).toBeNull();
      expect(await store.save(owner, [peruLine], null).catch(() => null)).toBeNull();
      await store.remove(owner);
    }
  });
}

describe("the in-memory cart store", () => {
  storeContract(() => createMemoryCartStore());
});

// These need a real MongoDB, so they only run when you give one, for example:
//   MONGODB_TEST_URI=mongodb://127.0.0.1:27017/solcacao_test pnpm test
// The collection is emptied, so the name of the database has to contain "test".
const testUri = process.env.MONGODB_TEST_URI;

describe.skipIf(!testUri)("the MongoDB cart store", () => {
  beforeAll(async () => {
    if (!/test/i.test(new URL(testUri!).pathname)) throw new Error("MONGODB_TEST_URI must point to a database with test in its name");
    await mongoose.connect(testUri!);
    await Cart.init();
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  storeContract(async () => {
    await Cart.deleteMany({});
    return createMongoCartStore();
  });

  it("gives a cart of a visitor a date after which MongoDB removes it, and a cart of a user none", async () => {
    const store = createMongoCartStore();
    await store.save(guest, [peruLine], null, inThirtyDays);
    await store.save(user, [peruLine], null);

    expect((await Cart.findOne({ guestId: guest.guestId }))?.expiresAt).toEqual(inThirtyDays);
    expect((await Cart.findOne({ userId: user.userId }))?.expiresAt).toBeUndefined();
  });

  it("has an index that removes a cart by itself after it expired, and one cart for each owner", async () => {
    const indexes = await Cart.collection.indexes();

    expect(indexes.some((index) => index.key.expiresAt === 1 && index.expireAfterSeconds === 0)).toBe(true);
    expect(indexes.some((index) => index.unique === true && index.key.userId === 1)).toBe(true);
    expect(indexes.some((index) => index.unique === true && index.key.guestId === 1)).toBe(true);
  });

  it.each([
    ["a quantity of 0", { quantity: 0 }],
    ["a quantity of more than 99", { quantity: 100 }],
    ["a quantity that is not whole", { quantity: 1.5 }],
    ["a price that is not whole cents", { unitPrice: 12.5 }],
    ["a negative price", { unitPrice: -1 }],
    ["a line id that is not one of ours", { lineId: "x-123" }],
    ["a kind that does not exist", { kind: "gift" }],
    ["no products", { productIds: [] }],
    ["more than six products", { productIds: Array.from({ length: 7 }, (_, index) => `64b7f0c2a1b2c3d4e5f60b0${index}`) }],
  ])("refuses a line with %s, and saves nothing", async (_what, change) => {
    const store = createMongoCartStore();

    await expect(store.save(user, [{ ...peruLine, ...change } as StoredCartLine], null)).rejects.toThrow();

    expect(await store.find(user)).toBeNull();
  });

  it("refuses a cart with more than 30 lines", async () => {
    const store = createMongoCartStore();
    const lines = Array.from({ length: 31 }, (_, index) => ({ ...peruLine, lineId: `p-64b7f0c2a1b2c3d4e5f6${String(index).padStart(4, "0")}` }));

    await expect(store.save(user, lines, null)).rejects.toThrow();
  });
});

describe("the MongoDB cart store without a connection", () => {
  it("answers 503", async () => {
    if (mongoose.connection.readyState !== 0) return;
    const store = createMongoCartStore();

    for (const attempt of [() => store.find(user), () => store.save(user, [peruLine], null), () => store.remove(user)]) {
      await expect(attempt()).rejects.toMatchObject({ status: 503, code: "DATABASE_UNAVAILABLE" });
    }
  });
});
