// A business profile store that keeps everything in memory, for the tests. It follows the same rules as the
// MongoDB store (the shared tests in b2b-profile.store.test.ts run against both).
import { setAndUnset, type B2BProfileStore, type StoredB2BProfile } from "../services/b2b-profile.store.ts";

export function createMemoryB2BProfileStore() {
  const records = new Map<string, StoredB2BProfile>();
  const start = Date.parse("2026-01-01T00:00:00.000Z");
  let ticks = 0;
  const stamp = () => new Date(start + ticks++ * 1000).toISOString();

  const store: B2BProfileStore & { all(): StoredB2BProfile[] } = {
    async findByUserId(userId) {
      const found = records.get(userId.toLowerCase());
      return found ? structuredClone(found) : null;
    },

    async save(userId, input) {
      const id = userId.toLowerCase();
      const existing = records.get(id);
      const { set, unset } = setAndUnset(input);

      const now = stamp();
      const next: StoredB2BProfile = existing ?? { userId: id, companyName: input.companyName, verificationStatus: "pending", createdAt: now, updatedAt: now };
      Object.assign(next, set);
      for (const field of Object.keys(unset)) delete next[field as "taxId" | "industry"];
      next.updatedAt = now;
      records.set(id, next);
      return structuredClone(next);
    },

    async setVerification(userId, status) {
      const found = records.get(userId.toLowerCase());
      if (!found) return null;
      found.verificationStatus = status;
      found.updatedAt = stamp();
      return structuredClone(found);
    },

    async remove(userId) {
      records.delete(userId.toLowerCase());
    },

    all() {
      return structuredClone([...records.values()]);
    },
  };

  return store;
}
