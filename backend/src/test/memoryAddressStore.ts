// An address store that keeps everything in memory, for the tests. It follows the same rules as the MongoDB
// store (the shared tests in address.store.test.ts run against both).
import mongoose from "mongoose";
import type { AddressStore, StoredAddress } from "../services/address.store.ts";

export function createMemoryAddressStore() {
  const records: StoredAddress[] = [];
  const start = Date.parse("2026-01-01T00:00:00.000Z");
  let ticks = 0;
  const stamp = () => new Date(start + ticks++ * 1000).toISOString();

  const owned = (userId: string, id: string) => records.find((record) => record.userId === userId.toLowerCase() && record.id === id.toLowerCase());

  const store: AddressStore & { all(): StoredAddress[] } = {
    async list(userId) {
      return structuredClone(records.filter((record) => record.userId === userId.toLowerCase()));
    },

    async findOwned(userId, id) {
      const found = owned(userId, id);
      return found ? structuredClone(found) : null;
    },

    async create(userId, data) {
      const created = stamp();
      const record: StoredAddress = { ...data, id: new mongoose.Types.ObjectId().toString(), userId: userId.toLowerCase(), createdAt: created, updatedAt: created };
      // the same rule as the unique index of the database
      if (record.isDefault && records.some((other) => other.userId === record.userId && other.isDefault)) {
        throw Object.assign(new Error("E11000 duplicate key error"), { code: 11000 });
      }
      records.push(record);
      return structuredClone(record);
    },

    async update(userId, id, change) {
      const found = owned(userId, id);
      if (!found) return null;
      // only these fields can change, whatever else the change carries
      for (const field of ["label", "street", "street2", "city", "state", "postalCode", "country"] as const) {
        const value = change[field];
        if (value === null) delete found[field as "street2"];
        else if (value !== undefined) Object.assign(found, { [field]: value });
      }
      found.updatedAt = stamp();
      return structuredClone(found);
    },

    async remove(userId, id) {
      const found = owned(userId, id);
      if (!found) return null;
      records.splice(records.indexOf(found), 1);
      return structuredClone(found);
    },

    async setDefault(userId, id) {
      const found = owned(userId, id);
      if (!found) return null;
      for (const record of records) if (record.userId === found.userId) record.isDefault = false;
      found.isDefault = true;
      found.updatedAt = stamp();
      return structuredClone(found);
    },

    all() {
      return structuredClone(records);
    },
  };

  return store;
}
