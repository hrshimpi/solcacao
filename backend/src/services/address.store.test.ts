import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Address } from "../models/address.model.ts";
import { createMemoryAddressStore } from "../test/memoryAddressStore.ts";
import { createMongoAddressStore, type AddressStore, type NewAddress } from "./address.store.ts";

const userId = "64b7f0c2a1b2c3d4e5f60718";
const otherUserId = "64b7f0c2a1b2c3d4e5f60719";
// an id that is valid, but that no address has
const missingId = "64b7f0c2a1b2c3d4e5f607ff";

const home: NewAddress = { label: "Home", street: "12 Cacao Lane", city: "Arlington", state: "TX", postalCode: "76010", country: "United States", isDefault: false };
const office: NewAddress = { label: "Office", street: "500 Main St", street2: "Suite 4", city: "Dallas", state: "TX", postalCode: "75201", country: "United States", isDefault: false };

// The same rules are checked on both stores: the one in memory (always) and the one for MongoDB
// (only when MONGODB_TEST_URI is set, see the readme).
function storeContract(makeStore: () => AddressStore | Promise<AddressStore>) {
  let store: AddressStore;

  beforeEach(async () => {
    store = await makeStore();
  });

  it("saves an address with an id, dates and the owner", async () => {
    const saved = await store.create(userId, office);

    expect(saved).toMatchObject({ ...office, userId });
    expect(saved.id).toMatch(/^[0-9a-f]{24}$/);
    expect(Number.isNaN(Date.parse(saved.createdAt))).toBe(false);
  });

  it("works without a second line", async () => {
    expect((await store.create(userId, home)).street2).toBeUndefined();
  });

  it("lists the addresses of a user, the oldest first, and only theirs", async () => {
    const first = await store.create(userId, home);
    await store.create(otherUserId, office);
    const second = await store.create(userId, office);

    expect((await store.list(userId)).map((address) => address.id)).toEqual([first.id, second.id]);
    expect(await store.list(otherUserId)).toHaveLength(1);
    expect(await store.list("not an id")).toEqual([]);
  });

  it("finds an address only for the user who owns it", async () => {
    const saved = await store.create(userId, home);

    expect(await store.findOwned(userId, saved.id)).toEqual(saved);
    expect(await store.findOwned(otherUserId, saved.id)).toBeNull();
    expect(await store.findOwned(userId, missingId)).toBeNull();
    expect(await store.findOwned(userId, "not an id")).toBeNull();
    expect(await store.findOwned(userId, '{"$ne": null}')).toBeNull();
  });

  it("changes parts of an address, and leaves the rest as it was", async () => {
    const saved = await store.create(userId, office);

    const changed = await store.update(userId, saved.id, { street: "501 Main St", city: "Irving" });

    expect(changed).toMatchObject({ ...office, street: "501 Main St", city: "Irving" });
  });

  it("takes the second line away with null", async () => {
    const saved = await store.create(userId, office);

    const changed = await store.update(userId, saved.id, { street2: null });

    expect(changed?.street2).toBeUndefined();
    expect(changed?.street).toBe("500 Main St");
  });

  it("never changes which address is the default through an update, or the owner", async () => {
    const saved = await store.create(userId, { ...home, isDefault: true });

    const changed = await store.update(userId, saved.id, { label: "Casa", isDefault: false, userId: otherUserId } as never);

    expect(changed).toMatchObject({ label: "Casa", isDefault: true, userId });
  });

  it("does not change the address of another user, or one that does not exist", async () => {
    const saved = await store.create(userId, home);

    expect(await store.update(otherUserId, saved.id, { label: "Mine now" })).toBeNull();
    expect(await store.update(userId, missingId, { label: "x" })).toBeNull();
    expect(await store.update(userId, "not an id", { label: "x" })).toBeNull();
    expect((await store.findOwned(userId, saved.id))?.label).toBe("Home");
  });

  it("takes an address away and answers it, and not that of another user", async () => {
    const saved = await store.create(userId, home);

    expect(await store.remove(otherUserId, saved.id)).toBeNull();
    expect(await store.remove(userId, saved.id)).toEqual(saved);
    expect(await store.remove(userId, saved.id)).toBeNull();
    expect(await store.list(userId)).toEqual([]);
    expect(await store.remove(userId, "not an id")).toBeNull();
  });

  describe("the default address", () => {
    it("moves from one address to another, and only one is the default", async () => {
      const first = await store.create(userId, { ...home, isDefault: true });
      const second = await store.create(userId, office);

      const chosen = await store.setDefault(userId, second.id);

      expect(chosen?.isDefault).toBe(true);
      expect((await store.findOwned(userId, first.id))?.isDefault).toBe(false);
      expect((await store.list(userId)).filter((address) => address.isDefault)).toHaveLength(1);
    });

    it("leaves the defaults of other users alone", async () => {
      const mine = await store.create(userId, { ...home, isDefault: true });
      const theirs = await store.create(otherUserId, { ...office, isDefault: true });
      const another = await store.create(userId, office);

      await store.setDefault(userId, another.id);

      expect((await store.findOwned(otherUserId, theirs.id))?.isDefault).toBe(true);
      expect((await store.findOwned(userId, mine.id))?.isDefault).toBe(false);
    });

    it("changes nothing when the address is not the user's, so a wrong id cannot take the default away", async () => {
      const mine = await store.create(userId, { ...home, isDefault: true });
      const theirs = await store.create(otherUserId, office);

      expect(await store.setDefault(userId, theirs.id)).toBeNull();
      expect(await store.setDefault(userId, missingId)).toBeNull();
      expect(await store.setDefault(userId, "not an id")).toBeNull();

      expect((await store.findOwned(userId, mine.id))?.isDefault).toBe(true);
      expect((await store.findOwned(otherUserId, theirs.id))?.isDefault).toBe(false);
    });

    it("works when the address already is the default", async () => {
      const only = await store.create(userId, { ...home, isDefault: true });

      expect((await store.setDefault(userId, only.id))?.isDefault).toBe(true);
    });

    it("never lets two defaults exist for one user", async () => {
      await store.create(userId, { ...home, isDefault: true });

      await expect(store.create(userId, { ...office, isDefault: true })).rejects.toMatchObject({ code: 11000 });
    });

    it("lets two different users each have a default", async () => {
      await store.create(userId, { ...home, isDefault: true });

      await expect(store.create(otherUserId, { ...office, isDefault: true })).resolves.toBeDefined();
    });
  });
}

describe("the in-memory address store", () => {
  storeContract(() => createMemoryAddressStore());
});

// These need a real MongoDB, so they only run when you give one, for example:
//   MONGODB_TEST_URI=mongodb://127.0.0.1:27017/solcacao_test pnpm test
// The collection is emptied, so the name of the database has to contain "test".
const testUri = process.env.MONGODB_TEST_URI;

describe.skipIf(!testUri)("the MongoDB address store", () => {
  beforeAll(async () => {
    if (!/test/i.test(new URL(testUri!).pathname)) throw new Error("MONGODB_TEST_URI must point to a database with test in its name");
    await mongoose.connect(testUri!);
    await Address.init();
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  storeContract(async () => {
    await Address.deleteMany({});
    return createMongoAddressStore();
  });

  it("keeps one default for a user even when two requests make a different address the default at the same moment", async () => {
    const store = createMongoAddressStore();
    await store.create(userId, { ...home, isDefault: true });
    const second = await store.create(userId, office);
    const third = await store.create(userId, { ...office, label: "Studio" });

    await Promise.allSettled([store.setDefault(userId, second.id), store.setDefault(userId, third.id)]);

    expect(await Address.countDocuments({ userId, isDefault: true })).toBe(1);
  });

  it("refuses an address the model does not accept", async () => {
    const store = createMongoAddressStore();

    await expect(store.create(userId, { ...home, street: "" })).rejects.toThrow();
    await expect(store.create(userId, { ...home, postalCode: "1" })).rejects.toThrow();
    await expect(store.create(userId, { ...home, label: "x".repeat(41) })).rejects.toThrow();
  });

  it("refuses an update the model does not accept, and keeps the address as it was", async () => {
    const store = createMongoAddressStore();
    const saved = await store.create(userId, home);

    await expect(store.update(userId, saved.id, { street: "" })).rejects.toThrow();

    expect((await store.findOwned(userId, saved.id))?.street).toBe("12 Cacao Lane");
  });

  it("has a partial unique index for the default address", async () => {
    const indexes = await Address.collection.indexes();

    expect(indexes.some((index) => index.unique === true && index.key.userId === 1 && JSON.stringify(index.partialFilterExpression) === '{"isDefault":true}')).toBe(true);
  });
});

describe("the MongoDB address store without a connection", () => {
  it("answers 503", async () => {
    if (mongoose.connection.readyState !== 0) return;
    const store = createMongoAddressStore();

    for (const attempt of [() => store.list(userId), () => store.create(userId, home), () => store.setDefault(userId, missingId), () => store.remove(userId, missingId)]) {
      await expect(attempt()).rejects.toMatchObject({ status: 503, code: "DATABASE_UNAVAILABLE" });
    }
  });
});
