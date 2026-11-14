// A cart store that keeps everything in memory, for the tests. It follows the same rules as the MongoDB store
// (the shared tests in cart.store.test.ts run against both).
import { isValidOwner, type CartOwner, type CartStore, type StoredCart, type StoredCartLine } from "../services/cart.store.ts";

interface CartRecord {
  key: string;
  lines: StoredCartLine[];
  version: number;
  updatedAt: string;
  expiresAt?: Date;
}

export function createMemoryCartStore() {
  const carts = new Map<string, CartRecord>();
  const start = Date.parse("2026-01-01T00:00:00.000Z");
  let ticks = 0;
  const stamp = () => new Date(start + ticks++ * 1000).toISOString();

  const keyOf = (owner: CartOwner) => ("userId" in owner ? `user:${owner.userId.toLowerCase()}` : `guest:${owner.guestId}`);
  const view = (record: CartRecord): StoredCart => ({ lines: structuredClone(record.lines), version: record.version, updatedAt: record.updatedAt });

  const store: CartStore & { all(): CartRecord[] } = {
    async find(owner) {
      if (!isValidOwner(owner)) return null;
      const found = carts.get(keyOf(owner));
      return found ? view(found) : null;
    },

    async save(owner, lines, expectedVersion, expiresAt) {
      if (!isValidOwner(owner)) return null;
      const key = keyOf(owner);
      const existing = carts.get(key);

      if (expectedVersion === null) {
        if (existing) return null;
        const created: CartRecord = { key, lines: structuredClone(lines), version: 1, updatedAt: stamp(), ...(expiresAt ? { expiresAt } : {}) };
        carts.set(key, created);
        return view(created);
      }

      if (!existing || existing.version !== expectedVersion) return null;
      existing.lines = structuredClone(lines);
      existing.version += 1;
      existing.updatedAt = stamp();
      if (expiresAt) existing.expiresAt = expiresAt;
      return view(existing);
    },

    async remove(owner) {
      if (!isValidOwner(owner)) return;
      carts.delete(keyOf(owner));
    },

    all() {
      return [...carts.values()].map((record) => structuredClone(record));
    },
  };

  return store;
}
