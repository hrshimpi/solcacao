import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Inquiry } from "../models/inquiry.model.ts";
import { createMemoryInquiryStore } from "../test/memoryInquiryStore.ts";
import { createMongoInquiryStore, DuplicateInquiryError, type InquiryStore } from "./inquiry.store.ts";

const general = { category: "general" as const, name: "Isabel Vasquez", email: "isabel@example.com", message: "Do you ship to Canada?" };

// The same rules are checked on every store: the one in memory (always) and the one for MongoDB
// (only when MONGODB_TEST_URI is set, see the readme).
function storeContract(makeStore: () => InquiryStore | Promise<InquiryStore>) {
  let store: InquiryStore;

  beforeEach(async () => {
    store = await makeStore();
  });

  describe("create", () => {
    it("saves an inquiry as new, with an id and a date", async () => {
      const saved = await store.create({ ...general, userId: "64b7f0c2a1b2c3d4e5f60718" });

      expect(saved).toMatchObject({ ...general, status: "new", userId: "64b7f0c2a1b2c3d4e5f60718" });
      expect(saved.id).toMatch(/^[0-9a-f]{24}$/);
      expect(Number.isNaN(Date.parse(saved.createdAt))).toBe(false);
    });

    it("saves feedback with a rating and no name", async () => {
      const saved = await store.create({ category: "feedback", rating: 4, message: "Lovely" });

      expect(saved).toMatchObject({ category: "feedback", rating: 4, message: "Lovely", status: "new" });
      expect(saved.name).toBeUndefined();
    });

    it("gives every inquiry its own id", async () => {
      const first = await store.create(general);
      const second = await store.create(general);

      expect(first.id).not.toBe(second.id);
    });

    it("lets one person write several messages", async () => {
      await store.create(general);
      await store.create({ ...general, category: "support" });

      expect((await store.list({ page: 1, limit: 10 })).total).toBe(2);
    });
  });

  describe("newsletter", () => {
    it("finds a subscriber by email", async () => {
      const saved = await store.create({ category: "newsletter", email: "isabel@example.com" });

      expect(await store.findNewsletter("isabel@example.com")).toMatchObject({ id: saved.id, category: "newsletter" });
    });

    it("does not find an address that is not subscribed, or only wrote to support", async () => {
      await store.create(general);

      expect(await store.findNewsletter("nobody@example.com")).toBeNull();
      expect(await store.findNewsletter("isabel@example.com")).toBeNull();
    });

    it("refuses a second sign up with the same address", async () => {
      await store.create({ category: "newsletter", email: "isabel@example.com" });

      await expect(store.create({ category: "newsletter", email: "isabel@example.com" })).rejects.toBeInstanceOf(DuplicateInquiryError);
      expect((await store.list({ category: "newsletter", page: 1, limit: 10 })).total).toBe(1);
    });

    it("lets an address that wrote a message also subscribe", async () => {
      await store.create(general);

      await expect(store.create({ category: "newsletter", email: "isabel@example.com" })).resolves.toMatchObject({ category: "newsletter" });
    });
  });

  describe("list", () => {
    async function seed() {
      const ids: Record<string, string> = {};
      ids.a = (await store.create({ ...general, name: "A" })).id;
      ids.b = (await store.create({ ...general, category: "wholesale", name: "B" })).id;
      ids.c = (await store.create({ ...general, category: "support", name: "C" })).id;
      ids.d = (await store.create({ category: "feedback", rating: 5 })).id;
      ids.e = (await store.create({ category: "newsletter", email: "news@example.com" })).id;
      await store.setStatus(ids.b, "responded");
      await store.setStatus(ids.d, "responded");
      return ids;
    }

    it("is empty when there is nothing", async () => {
      expect(await store.list({ page: 1, limit: 10 })).toEqual({ items: [], total: 0 });
    });

    it("puts the newest first", async () => {
      const ids = await seed();

      const { items, total } = await store.list({ page: 1, limit: 10 });

      expect(items.map((item) => item.id)).toEqual([ids.e, ids.d, ids.c, ids.b, ids.a]);
      expect(total).toBe(5);
    });

    it("filters by status", async () => {
      const ids = await seed();

      const responded = await store.list({ status: "responded", page: 1, limit: 10 });
      const unanswered = await store.list({ status: "new", page: 1, limit: 10 });

      expect(responded.items.map((item) => item.id)).toEqual([ids.d, ids.b]);
      expect(unanswered.items.map((item) => item.id)).toEqual([ids.e, ids.c, ids.a]);
    });

    it("filters by category", async () => {
      const ids = await seed();

      const wholesale = await store.list({ category: "wholesale", page: 1, limit: 10 });

      expect(wholesale.items.map((item) => item.id)).toEqual([ids.b]);
      expect(wholesale.total).toBe(1);
    });

    it("filters by status and category together", async () => {
      await seed();

      expect((await store.list({ status: "responded", category: "wholesale", page: 1, limit: 10 })).total).toBe(1);
      expect((await store.list({ status: "new", category: "wholesale", page: 1, limit: 10 })).total).toBe(0);
    });

    it("gives pages, and the total counts everything that matches", async () => {
      const ids = await seed();

      const first = await store.list({ page: 1, limit: 2 });
      const second = await store.list({ page: 2, limit: 2 });
      const third = await store.list({ page: 3, limit: 2 });
      const fourth = await store.list({ page: 4, limit: 2 });

      expect(first.items.map((item) => item.id)).toEqual([ids.e, ids.d]);
      expect(second.items.map((item) => item.id)).toEqual([ids.c, ids.b]);
      expect(third.items.map((item) => item.id)).toEqual([ids.a]);
      expect(fourth.items).toEqual([]);
      for (const page of [first, second, third, fourth]) expect(page.total).toBe(5);
    });
  });

  describe("setStatus", () => {
    it("changes the status, back and forth, and keeps the rest", async () => {
      const saved = await store.create(general);

      expect(await store.setStatus(saved.id, "responded")).toMatchObject({ ...general, id: saved.id, status: "responded" });
      expect((await store.list({ status: "responded", page: 1, limit: 10 })).total).toBe(1);

      expect(await store.setStatus(saved.id, "new")).toMatchObject({ status: "new" });
      expect((await store.list({ status: "responded", page: 1, limit: 10 })).total).toBe(0);
    });

    it("answers null for an id that does not exist", async () => {
      expect(await store.setStatus("64b7f0c2a1b2c3d4e5f60718", "responded")).toBeNull();
    });
  });
}

describe("the in-memory inquiry store", () => {
  storeContract(() => createMemoryInquiryStore());
});

// These need a real MongoDB, so they only run when you give one, for example:
//   MONGODB_TEST_URI=mongodb://127.0.0.1:27017/solcacao_test pnpm test
// The database is emptied, so the name has to contain "test".
const testUri = process.env.MONGODB_TEST_URI;

describe.skipIf(!testUri)("the MongoDB inquiry store", () => {
  beforeAll(async () => {
    if (!/test/i.test(new URL(testUri!).pathname)) throw new Error("MONGODB_TEST_URI must point to a database with test in its name");
    await mongoose.connect(testUri!);
    await Inquiry.init();
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  storeContract(async () => {
    await Inquiry.deleteMany({});
    return createMongoInquiryStore();
  });

  it("answers 503 when the database is not connected", async () => {
    await mongoose.disconnect();
    try {
      await expect(createMongoInquiryStore().list({ page: 1, limit: 10 })).rejects.toMatchObject({ status: 503, code: "DATABASE_UNAVAILABLE" });
    } finally {
      await mongoose.connect(testUri!);
    }
  });
});

describe("the MongoDB inquiry store without a connection", () => {
  it("answers 503 for every call", async () => {
    const store = createMongoInquiryStore();
    const expected = { status: 503, code: "DATABASE_UNAVAILABLE" };

    if (mongoose.connection.readyState !== 0) return;

    await expect(store.create(general)).rejects.toMatchObject(expected);
    await expect(store.findNewsletter("a@example.com")).rejects.toMatchObject(expected);
    await expect(store.list({ page: 1, limit: 10 })).rejects.toMatchObject(expected);
    await expect(store.setStatus("64b7f0c2a1b2c3d4e5f60718", "new")).rejects.toMatchObject(expected);
  });
});
