// A quote request store that keeps everything in memory, for the tests. It answers in the same shape as the
// MongoDB store (the shared tests in b2b.store.test.ts run against both).
import mongoose from "mongoose";
import type { B2BRequestStore, NewB2BRequest, StoredB2BRequest } from "../services/b2b.store.ts";

export function createMemoryB2BStore() {
  const records: StoredB2BRequest[] = [];
  const start = Date.parse("2026-01-01T00:00:00.000Z");
  let created = 0;

  const store: B2BRequestStore & { all(): StoredB2BRequest[] } = {
    async create(data: NewB2BRequest) {
      const now = new Date(start + created++ * 1000).toISOString();
      const record: StoredB2BRequest = {
        id: new mongoose.Types.ObjectId().toString(),
        userId: data.userId,
        companyName: data.companyName,
        contactName: data.contactName,
        cacaoProfile: data.cacaoProfile,
        packagingType: data.packagingType,
        quantityEstimate: data.quantityEstimate,
        notes: data.notes,
        brandAssets: data.brandAssets.map((asset) => ({ ...asset, uploadedAt: now })),
        status: "submitted",
        quoteAmount: null,
        createdAt: now,
        updatedAt: now,
      };
      records.push(record);
      return structuredClone(record);
    },

    all() {
      return structuredClone(records);
    },
  };

  return store;
}
