// An inquiry store that keeps everything in memory, for the tests. It follows the same rules as the MongoDB one
// (the shared tests in inquiry.store.test.ts run against both), so the service and the routes can be tested
// without a database.
import mongoose from "mongoose";
import {
  DuplicateInquiryError,
  type InquiryListQuery,
  type InquiryStore,
  type NewInquiry,
  type StoredInquiry,
} from "../services/inquiry.store.ts";
import type { InquiryStatus } from "../models/inquiry.model.ts";

export function createMemoryInquiryStore() {
  const records: StoredInquiry[] = [];
  const start = Date.parse("2026-01-01T00:00:00.000Z");
  let created = 0;

  const store: InquiryStore & { all(): StoredInquiry[] } = {
    async create(data: NewInquiry) {
      if (data.category === "newsletter" && records.some((r) => r.category === "newsletter" && r.email === data.email)) {
        throw new DuplicateInquiryError();
      }
      // every record is one second newer than the one before, so the order is always the same
      const record: StoredInquiry = {
        ...data,
        id: new mongoose.Types.ObjectId().toString(),
        status: "new",
        createdAt: new Date(start + created++ * 1000).toISOString(),
      };
      records.push(record);
      return { ...record };
    },

    async findNewsletter(email: string) {
      const found = records.find((r) => r.category === "newsletter" && r.email === email);
      return found ? { ...found } : null;
    },

    async list({ status, category, page, limit }: InquiryListQuery) {
      const matching = records
        .filter((r) => (!status || r.status === status) && (!category || r.category === category))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
      return { items: matching.slice((page - 1) * limit, page * limit).map((r) => ({ ...r })), total: matching.length };
    },

    async setStatus(id: string, status: InquiryStatus) {
      const found = records.find((r) => r.id === id);
      if (!found) return null;
      found.status = status;
      return { ...found };
    },

    all() {
      return records.map((r) => ({ ...r }));
    },
  };

  return store;
}
