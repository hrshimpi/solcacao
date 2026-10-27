import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { B2BRequest } from "../models/b2b-request.model.ts";
import { createMemoryB2BStore } from "../test/memoryB2BStore.ts";
import { createMongoB2BRequestStore, type B2BRequestStore } from "./b2b.store.ts";

const userId = "64b7f0c2a1b2c3d4e5f60718";
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
});

describe("the MongoDB quote request store without a connection", () => {
  it("answers 503", async () => {
    if (mongoose.connection.readyState !== 0) return;

    await expect(createMongoB2BRequestStore().create(data)).rejects.toMatchObject({ status: 503, code: "DATABASE_UNAVAILABLE" });
  });
});
