// A quote request store that keeps everything in memory, for the tests. It answers in the same shape as the
// MongoDB store (the shared tests in b2b.store.test.ts run against both).
import mongoose from "mongoose";
import type { RequestStatus } from "../models/b2b-request.model.ts";
import type { B2BRequestStore, NewB2BRequest, StoredB2BRequest } from "../services/b2b.store.ts";

export function createMemoryB2BStore() {
  const records: StoredB2BRequest[] = [];
  const start = Date.parse("2026-01-01T00:00:00.000Z");
  let ticks = 0;
  // every call is a second later than the one before, so the order of events can be told from the dates
  const now = () => new Date(start + ticks++ * 1000).toISOString();

  const store: B2BRequestStore & { all(): StoredB2BRequest[] } = {
    async create(data: NewB2BRequest) {
      const created = now();
      const record: StoredB2BRequest = {
        id: new mongoose.Types.ObjectId().toString(),
        userId: data.userId,
        companyName: data.companyName,
        contactName: data.contactName,
        cacaoProfile: data.cacaoProfile,
        packagingType: data.packagingType,
        quantityEstimate: data.quantityEstimate,
        notes: data.notes,
        brandAssets: data.brandAssets.map((asset) => ({ ...asset, uploadedAt: created })),
        status: "submitted",
        quoteAmount: null,
        createdAt: created,
        updatedAt: created,
      };
      records.push(record);
      return structuredClone(record);
    },

    async findById(id) {
      const found = records.find((record) => record.id === id.toLowerCase());
      return found ? structuredClone(found) : null;
    },

    async listForUser(userId, { page, limit }) {
      // the newest is the one that was added last
      const own = records.filter((record) => record.userId === userId.toLowerCase()).reverse();
      return { items: structuredClone(own.slice((page - 1) * limit, page * limit)), total: own.length };
    },

    async transition(id, from, change) {
      const found = records.find((record) => record.id === id.toLowerCase());
      if (!found || found.status !== from) return null;

      found.status = change.status;
      if (change.quoteAmount !== undefined) found.quoteAmount = change.quoteAmount;
      if (change.quoteNote !== undefined) found.quoteNote = change.quoteNote;
      found.updatedAt = now();
      return structuredClone(found);
    },

    all() {
      return structuredClone(records);
    },
  };

  return store;
}

// saves a request and walks it to the given status the way an admin would (a quoted one has a quote of 50.00)
export async function requestInStatus(store: B2BRequestStore, status: RequestStatus, data: NewB2BRequest): Promise<StoredB2BRequest> {
  const saved = await store.create(data);
  if (status === "submitted") return saved;
  if (status === "rejected") return (await store.transition(saved.id, "submitted", { status: "rejected" }))!;

  const quoted = (await store.transition(saved.id, "submitted", { status: "quoted", quoteAmount: 5000, quoteNote: "Valid for 30 days." }))!;
  if (status === "quoted") return quoted;
  return (await store.transition(saved.id, "quoted", { status: "approved" }))!;
}
