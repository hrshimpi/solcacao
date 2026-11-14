// A session store that keeps everything in memory, for the tests. It follows the same rules as the MongoDB
// store (the shared tests in session.store.test.ts run against both).
import type { Consumed, NewSession, SessionStore } from "../services/session.store.ts";

interface SessionRecord extends NewSession {
  usedAt: Date | null;
  revokedAt: Date | null;
}

export function createMemorySessionStore() {
  const records: SessionRecord[] = [];

  const store: SessionStore & { all(): SessionRecord[] } = {
    async create(session) {
      records.push({ ...session, usedAt: null, revokedAt: null });
    },

    async consume(tokenHash, now): Promise<Consumed> {
      const found = records.find((record) => record.tokenHash === tokenHash);
      if (!found || found.revokedAt || found.expiresAt <= now) return { status: "unknown" };
      if (found.usedAt) return { status: "reused", userId: found.userId, family: found.family, usedAt: found.usedAt };

      found.usedAt = now;
      return { status: "ok", userId: found.userId, family: found.family };
    },

    async revokeFamily(family, now) {
      for (const record of records) if (record.family === family && !record.revokedAt) record.revokedAt = now;
    },

    async revokeByToken(tokenHash, now) {
      const found = records.find((record) => record.tokenHash === tokenHash);
      if (found) await store.revokeFamily(found.family, now);
    },

    async revokeUser(userId, now) {
      for (const record of records) if (record.userId === userId && !record.revokedAt) record.revokedAt = now;
    },

    all() {
      return records.map((record) => ({ ...record }));
    },
  };

  return store;
}
