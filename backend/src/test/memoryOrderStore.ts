// An order store that keeps everything in memory, for the tests. It follows the same rules as the MongoDB store
// (the shared tests in order.store.test.ts run against both).
import { randomBytes } from "node:crypto";
import { orderNumberOf } from "../models/order.model.ts";
import { emptyByStatus, type OrderStore, type StoredOrder } from "../services/order.store.ts";

export function createMemoryOrderStore(): OrderStore & { all(): StoredOrder[] } {
  const records: StoredOrder[] = [];
  const start = Date.parse("2026-01-01T00:00:00.000Z");
  let ticks = 0;
  const stamp = () => new Date(start + ticks++ * 1000).toISOString();

  const newestFirst = (a: StoredOrder, b: StoredOrder) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);
  const page = (found: StoredOrder[], number: number, limit: number) => ({ items: structuredClone(found.sort(newestFirst).slice((number - 1) * limit, number * limit)), total: found.length });

  return {
    async create(data) {
      if (records.some((record) => record.cartKey === data.cartKey)) return null;
      const id = randomBytes(12).toString("hex");
      // an order is made at the time of its first step, like the timestamps of MongoDB are the time of the save
      const now = data.history[0]?.at ?? stamp();
      const order: StoredOrder = { ...structuredClone(data), id, number: orderNumberOf(id), createdAt: now, updatedAt: now };
      records.push(order);
      return structuredClone(order);
    },

    async findByCartKey(cartKey) {
      const found = records.find((record) => record.cartKey === cartKey);
      return found ? structuredClone(found) : null;
    },

    async findOwned(userId, id) {
      const found = records.find((record) => record.id === id.toLowerCase() && record.userId === userId.toLowerCase());
      return found ? structuredClone(found) : null;
    },

    async listForUser(userId, { page: number, limit }) {
      return page(
        records.filter((record) => record.userId === userId.toLowerCase()),
        number,
        limit,
      );
    },

    async findById(id) {
      const found = records.find((record) => record.id === id.toLowerCase());
      return found ? structuredClone(found) : null;
    },

    async list({ status, q, page: number, limit }) {
      const needle = q?.trim().toLowerCase();
      return page(
        records.filter((record) => (!status || record.status === status) && (!needle || [record.number, record.email, record.customerName].some((text) => text.toLowerCase().includes(needle)))),
        number,
        limit,
      );
    },

    async transition(id, from, to, at, options = {}) {
      const found = records.find((record) => record.id === id.toLowerCase());
      if (!found || !from.includes(found.status)) return null;
      found.status = to;
      found.history.push({ status: to, at: at.toISOString() });
      if (options.paymentStatus) found.payment.status = options.paymentStatus;
      found.updatedAt = stamp();
      return structuredClone(found);
    },

    async stats(since) {
      const byStatus = emptyByStatus();
      let revenue = 0;
      const today = { orders: 0, revenue: 0 };
      for (const record of records) {
        byStatus[record.status] += 1;
        if (record.status !== "cancelled") revenue += record.total;
        if (Date.parse(record.createdAt) >= since.getTime()) {
          today.orders += 1;
          if (record.status !== "cancelled") today.revenue += record.total;
        }
      }
      return { orders: records.length, revenue, byStatus, today };
    },

    all() {
      return structuredClone(records);
    },
  };
}
