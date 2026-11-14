import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { User } from "../models/user.model.ts";
import { createMemoryUserStore } from "../test/memoryUserStore.ts";
import { createMongoUserStore, type NewUser, type UserStore } from "./user.store.ts";

// an id that is valid, but that no user has
const missingId = "64b7f0c2a1b2c3d4e5f607ff";
const isabel: NewUser = { email: "isabel@example.com", name: "Isabel Vasquez", passwordHash: "hash-1", accountType: "retail", preferredLanguage: "en" };
const now = new Date("2026-03-01T12:00:00.000Z");
const minutes = (count: number) => new Date(now.getTime() + count * 60_000);

// The same rules are checked on both stores: the one in memory (always) and the one for MongoDB
// (only when MONGODB_TEST_URI is set, see the readme).
function storeContract(makeStore: () => UserStore | Promise<UserStore>) {
  let store: UserStore;

  beforeEach(async () => {
    store = await makeStore();
  });

  describe("create and find", () => {
    it("saves a user with an id and dates, and the defaults of a normal account", async () => {
      const saved = await store.create(isabel);

      expect(saved).toMatchObject({ email: "isabel@example.com", name: "Isabel Vasquez", role: "user", accountType: "retail", preferredLanguage: "en", marketingEmails: false });
      expect(saved.id).toMatch(/^[0-9a-f]{24}$/);
      expect(Number.isNaN(Date.parse(saved.createdAt))).toBe(false);
      expect(saved.phone).toBeUndefined();
    });

    it("never shows the password hash, or anything about failed sign ins, on a user", async () => {
      const saved = await store.create(isabel);
      const found = await store.findById(saved.id);

      for (const user of [saved, found]) {
        const text = JSON.stringify(user);
        expect(text).not.toContain("hash-1");
        expect(text).not.toMatch(/passwordHash|failedLogins|lockedUntil|resetToken|passwordReset/i);
      }
    });

    it("keeps the email in lower case", async () => {
      const saved = await store.create({ ...isabel, email: "Isabel@Example.COM" });

      expect(saved.email).toBe("isabel@example.com");
    });

    it("refuses a second account with the same email, whatever the case, with EMAIL_TAKEN", async () => {
      await store.create(isabel);

      for (const email of ["isabel@example.com", "ISABEL@EXAMPLE.COM"]) {
        await expect(store.create({ ...isabel, email })).rejects.toMatchObject({ status: 409, code: "EMAIL_TAKEN" });
      }
    });

    it("lets only the first of two sign ups at the same moment win", async () => {
      const results = await Promise.allSettled([store.create(isabel), store.create({ ...isabel, name: "Someone Else" })]);

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    });

    it("can make an admin when it is told to, and a business account", async () => {
      expect((await store.create({ ...isabel, email: "boss@example.com", role: "admin" })).role).toBe("admin");
      expect((await store.create({ ...isabel, email: "biz@example.com", accountType: "b2b" })).accountType).toBe("b2b");
    });

    it("finds a user by id, and finds nothing for an unknown id or a text that is not an id", async () => {
      const saved = await store.create(isabel);

      expect(await store.findById(saved.id)).toEqual(saved);
      expect(await store.findById(missingId)).toBeNull();
      expect(await store.findById("not an id")).toBeNull();
      expect(await store.findById('{"$ne": null}')).toBeNull();
    });
  });

  describe("credentials", () => {
    it("gives the hash and the counters for the sign in check, finding the email in any case", async () => {
      const saved = await store.create(isabel);

      for (const email of ["isabel@example.com", "ISABEL@example.com"]) {
        expect(await store.findCredentials(email)).toEqual({ user: saved, passwordHash: "hash-1", failedLogins: 0, lockedUntil: null });
      }
      expect(await store.findCredentialsById(saved.id)).toMatchObject({ passwordHash: "hash-1" });
    });

    it("finds nothing for an email without an account, or an id that is not one", async () => {
      expect(await store.findCredentials("nobody@example.com")).toBeNull();
      expect(await store.findCredentialsById(missingId)).toBeNull();
      expect(await store.findCredentialsById("not an id")).toBeNull();
    });

    it("does not let a query operator in the email match everybody", async () => {
      await store.create(isabel);

      expect(await store.findCredentials({ $ne: "" } as unknown as string)).toBeNull();
    });

    it("counts wrong passwords, and locks the account for a while when there are too many in a row", async () => {
      const { id } = await store.create(isabel);
      const rules = { maxFailures: 3, lockMs: 15 * 60_000, now };

      await store.recordFailedLogin(id, rules);
      await store.recordFailedLogin(id, rules);
      expect(await store.findCredentialsById(id)).toMatchObject({ failedLogins: 2, lockedUntil: null });

      await store.recordFailedLogin(id, rules);
      const locked = await store.findCredentialsById(id);
      expect(locked?.lockedUntil?.getTime()).toBe(minutes(15).getTime());
      expect(locked?.failedLogins).toBe(0);
    });

    it("starts the count again after a good sign in, and ends a lock", async () => {
      const { id } = await store.create(isabel);
      const rules = { maxFailures: 2, lockMs: 60_000, now };
      await store.recordFailedLogin(id, rules);
      await store.recordFailedLogin(id, rules);

      await store.recordLogin(id, now);

      expect(await store.findCredentialsById(id)).toMatchObject({ failedLogins: 0, lockedUntil: null });
    });

    it("ignores a failed or good sign in of a user that is not there", async () => {
      await store.recordFailedLogin(missingId, { maxFailures: 3, lockMs: 1000, now });
      await store.recordLogin(missingId, now);
      await store.recordFailedLogin("not an id", { maxFailures: 3, lockMs: 1000, now });
    });
  });

  describe("update", () => {
    it("changes the name, the phone, the language and the choice about emails", async () => {
      const { id } = await store.create(isabel);

      const changed = await store.update(id, { name: "Isabel V.", phone: "+1 555 010 2030", preferredLanguage: "es", marketingEmails: true });

      expect(changed).toMatchObject({ name: "Isabel V.", phone: "+1 555 010 2030", preferredLanguage: "es", marketingEmails: true });
      expect(await store.findById(id)).toMatchObject({ name: "Isabel V.", phone: "+1 555 010 2030" });
    });

    it("takes the phone away with null, and leaves what is not mentioned as it was", async () => {
      const { id } = await store.create(isabel);
      await store.update(id, { phone: "+1 555 010 2030", marketingEmails: true });

      const changed = await store.update(id, { phone: null });

      expect(changed?.phone).toBeUndefined();
      expect(changed).toMatchObject({ name: "Isabel Vasquez", marketingEmails: true });
    });

    it("never changes the email, the role or the account type, because a patch has no way to name them", async () => {
      const { id } = await store.create(isabel);

      const changed = await store.update(id, { email: "other@example.com", role: "admin", accountType: "b2b", passwordHash: "x" } as never);

      expect(changed).toMatchObject({ email: "isabel@example.com", role: "user", accountType: "retail" });
      expect((await store.findCredentialsById(id))?.passwordHash).toBe("hash-1");
    });

    it("answers null for a user that is not there", async () => {
      expect(await store.update(missingId, { name: "Nobody" })).toBeNull();
      expect(await store.update("not an id", { name: "Nobody" })).toBeNull();
    });
  });

  describe("passwords and reset links", () => {
    it("sets a new hash, and also ends a lock and the count of wrong passwords", async () => {
      const { id } = await store.create(isabel);
      await store.recordFailedLogin(id, { maxFailures: 1, lockMs: 60_000, now });

      await store.setPassword(id, "hash-2", now);

      expect(await store.findCredentialsById(id)).toMatchObject({ passwordHash: "hash-2", failedLogins: 0, lockedUntil: null });
    });

    it("finds the user of a reset link that is still good, once", async () => {
      const saved = await store.create(isabel);
      await store.setResetToken(saved.id, "token-hash", minutes(60));

      expect(await store.consumeResetToken("token-hash", minutes(30))).toMatchObject({ id: saved.id, email: saved.email });
      expect(await store.consumeResetToken("token-hash", minutes(30))).toBeNull();
    });

    it("lets only one of two requests with the same link win", async () => {
      const { id } = await store.create(isabel);
      await store.setResetToken(id, "token-hash", minutes(60));

      const results = await Promise.all([store.consumeResetToken("token-hash", now), store.consumeResetToken("token-hash", now)]);

      expect(results.filter((result) => result !== null)).toHaveLength(1);
    });

    it("finds nothing for a link that has run out, or one that was never made", async () => {
      const { id } = await store.create(isabel);
      await store.setResetToken(id, "token-hash", minutes(60));

      expect(await store.consumeResetToken("token-hash", minutes(61))).toBeNull();
      expect(await store.consumeResetToken("another-hash", minutes(1))).toBeNull();
    });

    it("keeps only the newest link of a user", async () => {
      const { id } = await store.create(isabel);
      await store.setResetToken(id, "first", minutes(60));
      await store.setResetToken(id, "second", minutes(60));

      expect(await store.consumeResetToken("first", now)).toBeNull();
      expect(await store.consumeResetToken("second", now)).not.toBeNull();
    });

    it("takes the open link away when the password is set another way", async () => {
      const { id } = await store.create(isabel);
      await store.setResetToken(id, "token-hash", minutes(60));

      await store.setPassword(id, "hash-2", now);

      expect(await store.consumeResetToken("token-hash", now)).toBeNull();
    });
  });

  describe("remove", () => {
    it("takes an account away, and ignores one that is not there", async () => {
      const { id } = await store.create(isabel);

      await store.remove(id);
      await store.remove(missingId);
      await store.remove("not an id");

      expect(await store.findById(id)).toBeNull();
      // the address can be used again
      await expect(store.create(isabel)).resolves.toBeDefined();
    });
  });
}

describe("the in-memory user store", () => {
  storeContract(() => createMemoryUserStore());
});

// These need a real MongoDB, so they only run when you give one, for example:
//   MONGODB_TEST_URI=mongodb://127.0.0.1:27017/solcacao_test pnpm test
// The collection is emptied, so the name of the database has to contain "test".
const testUri = process.env.MONGODB_TEST_URI;

describe.skipIf(!testUri)("the MongoDB user store", () => {
  beforeAll(async () => {
    if (!/test/i.test(new URL(testUri!).pathname)) throw new Error("MONGODB_TEST_URI must point to a database with test in its name");
    await mongoose.connect(testUri!);
    await User.init();
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  storeContract(async () => {
    await User.deleteMany({});
    return createMongoUserStore();
  });

  it("keeps the hash and the reset link out of an ordinary query, so they cannot leak by accident", async () => {
    const store = createMongoUserStore();
    const { id } = await store.create(isabel);
    await store.setResetToken(id, "token-hash", minutes(60));

    const plain = await User.findById(id);
    const asJson = JSON.stringify(plain);

    expect(plain?.passwordHash).toBeUndefined();
    expect(asJson).not.toContain("hash-1");
    expect(asJson).not.toContain("token-hash");
  });

  it("refuses a user the model does not accept", async () => {
    const store = createMongoUserStore();

    await expect(store.create({ ...isabel, email: "not an email" })).rejects.toThrow();
    await expect(store.create({ ...isabel, email: "other@example.com", name: "" })).rejects.toThrow();
  });

  it("refuses a phone number that does not look like one", async () => {
    const store = createMongoUserStore();
    const { id } = await store.create(isabel);

    await expect(store.update(id, { phone: "<script>" })).rejects.toThrow();
  });
});

describe("the MongoDB user store without a connection", () => {
  it("answers 503", async () => {
    if (mongoose.connection.readyState !== 0) return;
    const store = createMongoUserStore();

    const attempts = [
      () => store.create(isabel),
      () => store.findById(missingId),
      () => store.findCredentials("isabel@example.com"),
      () => store.update(missingId, { name: "x" }),
      () => store.consumeResetToken("x", now),
    ];

    for (const attempt of attempts) {
      await expect(attempt()).rejects.toMatchObject({ status: 503, code: "DATABASE_UNAVAILABLE" });
    }
  });
});
