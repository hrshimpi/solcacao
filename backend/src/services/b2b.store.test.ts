import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { B2BRequest } from "../models/b2b-request.model.ts";
import { createMemoryB2BStore } from "../test/memoryB2BStore.ts";
import { createMongoB2BRequestStore, type B2BRequestStore } from "./b2b.store.ts";

const userId = "64b7f0c2a1b2c3d4e5f60718";
const otherUserId = "64b7f0c2a1b2c3d4e5f60719";
// an id that is valid, but that no request has
const missingId = "64b7f0c2a1b2c3d4e5f607ff";
const data = {
  userId,
  companyName: "Hacienda Brands",
  contactName: "Isabel Vasquez",
  cacaoProfile: "Ecuador",
  packagingType: "rigid_box" as const,
  quantityEstimate: 800,
  notes: "Before the holidays, please.",
  brandAssets: [],
};

// The same rules are checked on both stores: the one in memory (always) and the one for MongoDB
// (only when MONGODB_TEST_URI is set, see the readme).
function storeContract(makeStore: () => B2BRequestStore | Promise<B2BRequestStore>) {
  let store: B2BRequestStore;

  beforeEach(async () => {
    store = await makeStore();
  });

  it("saves a request as submitted, with an id, dates and no quote", async () => {
    const saved = await store.create(data);

    expect(saved).toMatchObject({ ...data, status: "submitted", quoteAmount: null });
    expect(saved.id).toMatch(/^[0-9a-f]{24}$/);
    expect(Number.isNaN(Date.parse(saved.createdAt))).toBe(false);
    expect(Number.isNaN(Date.parse(saved.updatedAt))).toBe(false);
    expect(saved.quoteNote).toBeUndefined();
  });

  it("keeps the brand files, with a date for each and no address", async () => {
    const saved = await store.create({
      ...data,
      brandAssets: [
        { originalName: "logo.png", storedName: "11111111-2222-3333-4444-555555555555.png", mimeType: "image/png", sizeBytes: 20480 },
        { originalName: "guide.pdf", storedName: "66666666-7777-8888-9999-000000000000.pdf", mimeType: "application/pdf", sizeBytes: 1024 },
      ],
    });

    expect(saved.brandAssets).toEqual([
      { originalName: "logo.png", storedName: "11111111-2222-3333-4444-555555555555.png", mimeType: "image/png", sizeBytes: 20480, uploadedAt: expect.any(String) },
      { originalName: "guide.pdf", storedName: "66666666-7777-8888-9999-000000000000.pdf", mimeType: "application/pdf", sizeBytes: 1024, uploadedAt: expect.any(String) },
    ]);
    expect(JSON.stringify(saved)).not.toContain("http");
  });

  it("works without notes", async () => {
    const saved = await store.create({ ...data, notes: undefined });

    expect(saved.notes).toBeUndefined();
  });

  it("gives every request its own id", async () => {
    const first = await store.create(data);
    const second = await store.create(data);

    expect(first.id).not.toBe(second.id);
  });

  describe("findById", () => {
    it("finds a request with everything that was saved", async () => {
      const saved = await store.create({
        ...data,
        brandAssets: [{ originalName: "logo.png", storedName: "11111111-2222-3333-4444-555555555555.png", mimeType: "image/png", sizeBytes: 20480 }],
      });

      expect(await store.findById(saved.id)).toEqual(saved);
    });

    it("answers null for an id that nothing has", async () => {
      await store.create(data);

      expect(await store.findById(missingId)).toBeNull();
    });

    it.each(["", "abc", "not-an-id", "64b7f0c2a1b2c3d4e5f6071", "../../etc/passwd"])("answers null for %j, which cannot be an id", async (id) => {
      expect(await store.findById(id)).toBeNull();
    });
  });

  describe("listForUser", () => {
    it("lists only the requests of that user, newest first", async () => {
      const first = await store.create(data);
      await store.create({ ...data, userId: otherUserId, companyName: "Someone Else" });
      const third = await store.create(data);

      const { items, total } = await store.listForUser(userId, { page: 1, limit: 20 });

      expect(items.map((item) => item.id)).toEqual([third.id, first.id]);
      expect(items.every((item) => item.userId === userId)).toBe(true);
      expect(total).toBe(2);
    });

    it("pages through the list and counts them all", async () => {
      const saved = [];
      for (let i = 0; i < 5; i++) saved.push(await store.create({ ...data, companyName: `Company ${i}` }));
      const newestFirst = saved.map((item) => item.id).reverse();

      const first = await store.listForUser(userId, { page: 1, limit: 2 });
      const second = await store.listForUser(userId, { page: 2, limit: 2 });
      const last = await store.listForUser(userId, { page: 3, limit: 2 });

      expect(first.items.map((item) => item.id)).toEqual(newestFirst.slice(0, 2));
      expect(second.items.map((item) => item.id)).toEqual(newestFirst.slice(2, 4));
      expect(last.items.map((item) => item.id)).toEqual(newestFirst.slice(4));
      expect([first.total, second.total, last.total]).toEqual([5, 5, 5]);
    });

    it("answers an empty page after the last one, and an empty list for a user with nothing", async () => {
      await store.create(data);

      expect(await store.listForUser(userId, { page: 2, limit: 20 })).toEqual({ items: [], total: 1 });
      expect(await store.listForUser(otherUserId, { page: 1, limit: 20 })).toEqual({ items: [], total: 0 });
    });

    it("answers an empty list for something that cannot be a user id", async () => {
      await store.create(data);

      expect(await store.listForUser("not-an-id", { page: 1, limit: 20 })).toEqual({ items: [], total: 0 });
    });
  });

  describe("transition", () => {
    it("changes the status, saves the quote and moves the update date", async () => {
      const saved = await store.create(data);

      const quoted = await store.transition(saved.id, "submitted", { status: "quoted", quoteAmount: 125000, quoteNote: "Includes shipping." });

      expect(quoted).toMatchObject({ id: saved.id, status: "quoted", quoteAmount: 125000, quoteNote: "Includes shipping.", createdAt: saved.createdAt });
      expect(Date.parse(quoted!.updatedAt)).toBeGreaterThan(Date.parse(saved.updatedAt));
      expect(await store.findById(saved.id)).toEqual(quoted);
    });

    it("leaves the rest of the request alone", async () => {
      const saved = await store.create(data);

      const quoted = await store.transition(saved.id, "submitted", { status: "quoted", quoteAmount: 5000 });

      expect(quoted).toMatchObject({ userId, companyName: data.companyName, contactName: data.contactName, quantityEstimate: 800, notes: data.notes });
    });

    it("keeps the amount and the note when a later change does not send them", async () => {
      const saved = await store.create(data);
      await store.transition(saved.id, "submitted", { status: "quoted", quoteAmount: 5000, quoteNote: "Valid for 30 days." });

      const approved = await store.transition(saved.id, "quoted", { status: "approved" });

      expect(approved).toMatchObject({ status: "approved", quoteAmount: 5000, quoteNote: "Valid for 30 days." });
    });

    it("can replace the note with a later one", async () => {
      const saved = await store.create(data);
      await store.transition(saved.id, "submitted", { status: "quoted", quoteAmount: 5000, quoteNote: "First." });

      const rejected = await store.transition(saved.id, "quoted", { status: "rejected", quoteNote: "Too expensive for them." });

      expect(rejected).toMatchObject({ status: "rejected", quoteAmount: 5000, quoteNote: "Too expensive for them." });
    });

    it("does nothing when the request has another status than the one expected", async () => {
      const saved = await store.create(data);
      await store.transition(saved.id, "submitted", { status: "quoted", quoteAmount: 5000 });

      const lost = await store.transition(saved.id, "submitted", { status: "rejected" });

      expect(lost).toBeNull();
      expect(await store.findById(saved.id)).toMatchObject({ status: "quoted", quoteAmount: 5000 });
    });

    it("lets only one of two changes made at the same moment win", async () => {
      const saved = await store.create(data);

      const results = await Promise.all([
        store.transition(saved.id, "submitted", { status: "quoted", quoteAmount: 1000 }),
        store.transition(saved.id, "submitted", { status: "rejected" }),
      ]);

      expect(results.filter(Boolean)).toHaveLength(1);
    });

    it("answers null for an id that nothing has, or that cannot be an id", async () => {
      expect(await store.transition(missingId, "submitted", { status: "rejected" })).toBeNull();
      expect(await store.transition("not-an-id", "submitted", { status: "rejected" })).toBeNull();
    });
  });
}

describe("the in-memory quote request store", () => {
  storeContract(() => createMemoryB2BStore());
});

// These need a real MongoDB, so they only run when you give one, for example:
//   MONGODB_TEST_URI=mongodb://127.0.0.1:27017/solcacao_test pnpm test
// The collection is emptied, so the name of the database has to contain "test".
const testUri = process.env.MONGODB_TEST_URI;

describe.skipIf(!testUri)("the MongoDB quote request store", () => {
  beforeAll(async () => {
    if (!/test/i.test(new URL(testUri!).pathname)) throw new Error("MONGODB_TEST_URI must point to a database with test in its name");
    await mongoose.connect(testUri!);
    await B2BRequest.init();
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  storeContract(async () => {
    await B2BRequest.deleteMany({});
    return createMongoB2BRequestStore();
  });

  it("refuses a request the model does not accept", async () => {
    await expect(createMongoB2BRequestStore().create({ ...data, quantityEstimate: 0 })).rejects.toThrow();
  });

  it("refuses a quote amount the model does not accept, and keeps the request as it was", async () => {
    const store = createMongoB2BRequestStore();
    const saved = await store.create(data);

    await expect(store.transition(saved.id, "submitted", { status: "quoted", quoteAmount: 12.5 })).rejects.toThrow();

    expect(await store.findById(saved.id)).toMatchObject({ status: "submitted", quoteAmount: null });
  });
});

describe("the MongoDB quote request store without a connection", () => {
  it("answers 503", async () => {
    if (mongoose.connection.readyState !== 0) return;
    const store = createMongoB2BRequestStore();

    const attempts = [
      () => store.create(data),
      () => store.findById(missingId),
      () => store.listForUser(userId, { page: 1, limit: 20 }),
      () => store.transition(missingId, "submitted", { status: "rejected" }),
    ];

    for (const attempt of attempts) {
      await expect(attempt()).rejects.toMatchObject({ status: 503, code: "DATABASE_UNAVAILABLE" });
    }
  });
});
