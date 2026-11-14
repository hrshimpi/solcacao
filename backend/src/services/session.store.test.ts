import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { RefreshSession } from "../models/refresh-session.model.ts";
import { createMemorySessionStore } from "../test/memorySessionStore.ts";
import { createMongoSessionStore, type SessionStore } from "./session.store.ts";

const userId = "64b7f0c2a1b2c3d4e5f60718";
const otherUserId = "64b7f0c2a1b2c3d4e5f60719";
const now = new Date("2026-03-01T12:00:00.000Z");
const later = (ms: number) => new Date(now.getTime() + ms);
const week = 7 * 24 * 60 * 60 * 1000;

const session = (tokenHash: string, family = "family-1", owner = userId) => ({ userId: owner, tokenHash, family, expiresAt: later(week) });

// The same rules are checked on both stores: the one in memory (always) and the one for MongoDB
// (only when MONGODB_TEST_URI is set, see the readme).
function storeContract(makeStore: () => SessionStore | Promise<SessionStore>) {
  let store: SessionStore;

  beforeEach(async () => {
    store = await makeStore();
  });

  it("lets a token be used once, and says who it belonged to", async () => {
    await store.create(session("hash-a"));

    expect(await store.consume("hash-a", now)).toEqual({ status: "ok", userId, family: "family-1" });
  });

  it("knows a token that is used a second time, and when it was used first", async () => {
    await store.create(session("hash-a"));
    await store.consume("hash-a", now);

    expect(await store.consume("hash-a", later(5000))).toEqual({ status: "reused", userId, family: "family-1", usedAt: now });
  });

  it("lets only one of two requests with the same token win", async () => {
    await store.create(session("hash-a"));

    const results = await Promise.all([store.consume("hash-a", now), store.consume("hash-a", now)]);

    expect(results.map((result) => result.status).sort()).toEqual(["ok", "reused"]);
  });

  it("knows nothing about a token that was never made", async () => {
    expect(await store.consume("hash-zzz", now)).toEqual({ status: "unknown" });
  });

  it("knows nothing about a token that has run out, used or not", async () => {
    await store.create(session("hash-a"));
    await store.create(session("hash-b", "family-2"));
    await store.consume("hash-b", now);

    expect(await store.consume("hash-a", later(week + 1000))).toEqual({ status: "unknown" });
    expect(await store.consume("hash-b", later(week + 1000))).toEqual({ status: "unknown" });
  });

  it("ends every token of a family, also ones that were made after the sign in, and no others", async () => {
    await store.create(session("hash-a"));
    await store.create(session("hash-b"));
    await store.create(session("hash-c", "family-2"));

    await store.revokeFamily("family-1", now);

    expect(await store.consume("hash-a", now)).toEqual({ status: "unknown" });
    expect(await store.consume("hash-b", now)).toEqual({ status: "unknown" });
    expect(await store.consume("hash-c", now)).toMatchObject({ status: "ok" });
  });

  it("ends the whole sign in of a token with revokeByToken, and ignores a token that does not exist", async () => {
    await store.create(session("hash-a"));
    await store.create(session("hash-b"));
    await store.create(session("hash-c", "family-2"));

    await store.revokeByToken("hash-a", now);
    await store.revokeByToken("hash-zzz", now);

    expect(await store.consume("hash-b", now)).toEqual({ status: "unknown" });
    expect(await store.consume("hash-c", now)).toMatchObject({ status: "ok" });
  });

  it("ends all the sign ins of one user, and not those of another", async () => {
    await store.create(session("hash-a", "family-1", userId));
    await store.create(session("hash-b", "family-2", userId));
    await store.create(session("hash-c", "family-3", otherUserId));

    await store.revokeUser(userId, now);
    await store.revokeUser("not an id", now);

    expect(await store.consume("hash-a", now)).toEqual({ status: "unknown" });
    expect(await store.consume("hash-b", now)).toEqual({ status: "unknown" });
    expect(await store.consume("hash-c", now)).toMatchObject({ status: "ok", userId: otherUserId });
  });

  it("does not call a revoked token a theft when it is shown again", async () => {
    await store.create(session("hash-a"));
    await store.consume("hash-a", now);
    await store.revokeFamily("family-1", now);

    expect(await store.consume("hash-a", later(1000))).toEqual({ status: "unknown" });
  });
}

describe("the in-memory session store", () => {
  storeContract(() => createMemorySessionStore());
});

// These need a real MongoDB, so they only run when you give one, for example:
//   MONGODB_TEST_URI=mongodb://127.0.0.1:27017/solcacao_test pnpm test
// The collection is emptied, so the name of the database has to contain "test".
const testUri = process.env.MONGODB_TEST_URI;

describe.skipIf(!testUri)("the MongoDB session store", () => {
  beforeAll(async () => {
    if (!/test/i.test(new URL(testUri!).pathname)) throw new Error("MONGODB_TEST_URI must point to a database with test in its name");
    await mongoose.connect(testUri!);
    await RefreshSession.init();
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  storeContract(async () => {
    await RefreshSession.deleteMany({});
    return createMongoSessionStore();
  });

  it("keeps only the hash of the token, never the token itself", async () => {
    await createMongoSessionStore().create(session("hash-a"));

    const saved = await RefreshSession.findOne({}).lean();

    expect(Object.keys(saved ?? {})).not.toContain("token");
    expect(saved?.tokenHash).toBe("hash-a");
  });

  it("has an index that removes a session by itself after it expires", async () => {
    const indexes = await RefreshSession.collection.indexes();

    expect(indexes.some((index) => index.key.expiresAt === 1 && index.expireAfterSeconds === 0)).toBe(true);
  });

  it("refuses a second session with the same token hash", async () => {
    const store = createMongoSessionStore();
    await store.create(session("hash-a"));

    await expect(store.create(session("hash-a", "family-2"))).rejects.toMatchObject({ code: 11000 });
  });
});

describe("the MongoDB session store without a connection", () => {
  it("answers 503", async () => {
    if (mongoose.connection.readyState !== 0) return;
    const store = createMongoSessionStore();

    for (const attempt of [() => store.create(session("x")), () => store.consume("x", now), () => store.revokeFamily("x", now), () => store.revokeUser(userId, now)]) {
      await expect(attempt()).rejects.toMatchObject({ status: 503, code: "DATABASE_UNAVAILABLE" });
    }
  });
});
