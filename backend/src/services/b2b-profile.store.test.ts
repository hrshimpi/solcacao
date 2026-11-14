import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { B2BProfile } from "../models/b2b-profile.model.ts";
import { createMemoryB2BProfileStore } from "../test/memoryB2BProfileStore.ts";
import { createMongoB2BProfileStore, type B2BProfileStore } from "./b2b-profile.store.ts";

const userId = "64b7f0c2a1b2c3d4e5f60718";
const otherUserId = "64b7f0c2a1b2c3d4e5f60719";

// The same rules are checked on both stores: the one in memory (always) and the one for MongoDB
// (only when MONGODB_TEST_URI is set, see the readme).
function storeContract(makeStore: () => B2BProfileStore | Promise<B2BProfileStore>) {
  let store: B2BProfileStore;

  beforeEach(async () => {
    store = await makeStore();
  });

  it("creates the details of a business, waiting for verification", async () => {
    const saved = await store.save(userId, { companyName: "Hacienda Brands", taxId: "12-3456789", industry: "Hospitality" });

    expect(saved).toMatchObject({ userId, companyName: "Hacienda Brands", taxId: "12-3456789", industry: "Hospitality", verificationStatus: "pending" });
    expect(Number.isNaN(Date.parse(saved.createdAt))).toBe(false);
  });

  it("finds the details of a user, and nothing for a user without them", async () => {
    await store.save(userId, { companyName: "Hacienda Brands" });

    expect(await store.findByUserId(userId)).toMatchObject({ companyName: "Hacienda Brands" });
    expect(await store.findByUserId(otherUserId)).toBeNull();
    expect(await store.findByUserId("not an id")).toBeNull();
  });

  it("changes the details of a user when they are saved again, and still keeps one set for each user", async () => {
    await store.save(userId, { companyName: "Hacienda Brands", taxId: "12-3456789" });

    const changed = await store.save(userId, { companyName: "Hacienda Brands LLC" });

    expect(changed).toMatchObject({ companyName: "Hacienda Brands LLC", taxId: "12-3456789" });
  });

  it("takes a value away with null, and leaves a value that is not mentioned", async () => {
    await store.save(userId, { companyName: "Hacienda Brands", taxId: "12-3456789", industry: "Hospitality" });

    const changed = await store.save(userId, { companyName: "Hacienda Brands", taxId: null });

    expect(changed.taxId).toBeUndefined();
    expect(changed.industry).toBe("Hospitality");
  });

  it("does not let saving the details change the verification, which only the team sets", async () => {
    await store.save(userId, { companyName: "Hacienda Brands" });
    await store.setVerification(userId, "verified");

    const changed = await store.save(userId, { companyName: "A New Name", verificationStatus: "rejected" } as never);

    expect(changed.verificationStatus).toBe("verified");
  });

  it("sets the verification for the team, and says so when there are no details to verify", async () => {
    await store.save(userId, { companyName: "Hacienda Brands" });

    expect(await store.setVerification(userId, "verified")).toMatchObject({ verificationStatus: "verified" });
    expect(await store.setVerification(userId, "rejected")).toMatchObject({ verificationStatus: "rejected" });
    expect(await store.setVerification(otherUserId, "verified")).toBeNull();
    expect(await store.setVerification("not an id", "verified")).toBeNull();
  });

  it("keeps the details of each user apart", async () => {
    await store.save(userId, { companyName: "One" });
    await store.save(otherUserId, { companyName: "Two" });

    expect((await store.findByUserId(userId))?.companyName).toBe("One");
    expect((await store.findByUserId(otherUserId))?.companyName).toBe("Two");
  });

  it("takes the details away", async () => {
    await store.save(userId, { companyName: "Hacienda Brands" });

    await store.remove(userId);
    await store.remove(otherUserId);
    await store.remove("not an id");

    expect(await store.findByUserId(userId)).toBeNull();
  });
}

describe("the in-memory business profile store", () => {
  storeContract(() => createMemoryB2BProfileStore());
});

// These need a real MongoDB, so they only run when you give one, for example:
//   MONGODB_TEST_URI=mongodb://127.0.0.1:27017/solcacao_test pnpm test
// The collection is emptied, so the name of the database has to contain "test".
const testUri = process.env.MONGODB_TEST_URI;

describe.skipIf(!testUri)("the MongoDB business profile store", () => {
  beforeAll(async () => {
    if (!/test/i.test(new URL(testUri!).pathname)) throw new Error("MONGODB_TEST_URI must point to a database with test in its name");
    await mongoose.connect(testUri!);
    await B2BProfile.init();
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  storeContract(async () => {
    await B2BProfile.deleteMany({});
    return createMongoB2BProfileStore();
  });

  it("keeps one set of details for each user, even when two saves arrive at the same moment", async () => {
    const store = createMongoB2BProfileStore();

    await Promise.all([store.save(userId, { companyName: "One" }), store.save(userId, { companyName: "Two" })]);

    expect(await B2BProfile.countDocuments({ userId })).toBe(1);
  });

  it("refuses details the model does not accept", async () => {
    const store = createMongoB2BProfileStore();

    await expect(store.save(userId, { companyName: "" })).rejects.toThrow();
    await expect(store.save(userId, { companyName: "x".repeat(121) })).rejects.toThrow();
  });
});

describe("the MongoDB business profile store without a connection", () => {
  it("answers 503", async () => {
    if (mongoose.connection.readyState !== 0) return;
    const store = createMongoB2BProfileStore();

    for (const attempt of [() => store.findByUserId(userId), () => store.save(userId, { companyName: "x" }), () => store.setVerification(userId, "verified")]) {
      await expect(attempt()).rejects.toMatchObject({ status: 503, code: "DATABASE_UNAVAILABLE" });
    }
  });
});
