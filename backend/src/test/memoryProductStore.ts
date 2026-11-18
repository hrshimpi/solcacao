// A product store that keeps everything in memory, for the tests. It follows the same rules as the MongoDB store
// (the shared tests in product.store.test.ts run against both).
import mongoose from "mongoose";
import { searchable, searchTextOf, type ProductSort } from "../models/product.model.ts";
import { DEFAULT_LOW_STOCK } from "../services/stock.ts";
import { onlyEditable, skuTaken, slugTaken, type NewProduct, type ProductChange, type ProductQuery, type ProductStore, type StoredProduct } from "../services/product.store.ts";

const order: Record<ProductSort, (a: StoredProduct, b: StoredProduct) => number> = {
  featured: (a, b) => Number(b.featured) - Number(a.featured) || a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
  price_asc: (a, b) => a.price - b.price || a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
  price_desc: (a, b) => b.price - a.price || a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
  pct_desc: (a, b) => b.percentage - a.percentage || a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt) || a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
};

export function createMemoryProductStore() {
  const records: StoredProduct[] = [];
  const start = Date.parse("2026-01-01T00:00:00.000Z");
  let ticks = 0;
  const stamp = () => new Date(start + ticks++ * 1000).toISOString();

  const visible = (visibility?: { includeInactive?: boolean }) => (record: StoredProduct) => visibility?.includeInactive === true || record.active;

  function matches(record: StoredProduct, query: ProductQuery): boolean {
    if (!query.includeInactive && !record.active) return false;
    if (query.origins?.length && !query.origins.includes(record.origin)) return false;
    if (query.categories?.length && !query.categories.includes(record.category)) return false;
    if (query.minPct !== undefined && record.percentage < query.minPct) return false;
    if (query.maxPct !== undefined && record.percentage > query.maxPct) return false;
    if (query.notes?.length && !query.notes.some((note) => record.notes.includes(note))) return false;
    if (query.featured !== undefined && record.featured !== query.featured) return false;
    // a search that is nothing but accents (like "^") finds nothing
    if (query.q && (searchable(query.q) === "" || !searchTextOf(record).includes(searchable(query.q)))) return false;
    return true;
  }

  const store: ProductStore & { all(): StoredProduct[] } = {
    async list(query) {
      const found = records.filter((record) => matches(record, query)).sort(order[query.sort]);
      return { items: structuredClone(found.slice((query.page - 1) * query.limit, query.page * query.limit)), total: found.length };
    },

    async findBySlug(slug, visibility) {
      if (typeof slug !== "string") return null;
      const found = records.find((record) => record.slug === slug.toLowerCase() && visible(visibility)(record));
      return found ? structuredClone(found) : null;
    },

    async findById(id, visibility) {
      const found = records.find((record) => record.id === id.toLowerCase() && visible(visibility)(record));
      return found ? structuredClone(found) : null;
    },

    async findByIds(ids, visibility) {
      const unique = [...new Set(ids.map((id) => id.toLowerCase()))];
      return structuredClone(unique.map((id) => records.find((record) => record.id === id && visible(visibility)(record))).filter((record): record is StoredProduct => record !== undefined));
    },

    async related(product, limit) {
      const found = records
        .filter((record) => record.active && record.id !== product.id && (record.category === product.category || record.origin === product.origin))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
      return structuredClone(found.slice(0, limit));
    },

    async create(data: NewProduct, quantity) {
      if (records.some((record) => record.slug === data.slug.toLowerCase())) throw slugTaken();
      if (records.some((record) => record.sku === data.sku.toUpperCase())) throw skuTaken();

      const created = stamp();
      const record: StoredProduct = {
        ...structuredClone(data),
        slug: data.slug.toLowerCase(),
        sku: data.sku.toUpperCase(),
        id: new mongoose.Types.ObjectId().toString(),
        quantity,
        lowStockThreshold: DEFAULT_LOW_STOCK,
        createdAt: created,
        updatedAt: created,
      };
      records.push(record);
      return structuredClone(record);
    },

    async update(id, change: ProductChange) {
      const found = records.find((record) => record.id === id.toLowerCase());
      if (!found) return null;
      if (change.slug !== undefined && records.some((record) => record !== found && record.slug === change.slug!.toLowerCase())) throw slugTaken();
      if (change.sku !== undefined && records.some((record) => record !== found && record.sku === change.sku!.toUpperCase())) throw skuTaken();

      Object.assign(found, structuredClone(onlyEditable(change)));
      if (change.slug !== undefined) found.slug = change.slug.toLowerCase();
      if (change.sku !== undefined) found.sku = change.sku.toUpperCase();
      found.updatedAt = stamp();
      return structuredClone(found);
    },

    async setInventory(id, { quantity, lowStockThreshold }) {
      const found = records.find((record) => record.id === id.toLowerCase());
      if (!found) return null;
      found.quantity = quantity;
      if (lowStockThreshold !== undefined) found.lowStockThreshold = lowStockThreshold;
      return structuredClone(found);
    },

    async reserveStock(items) {
      const taken: { productId: string; quantity: number }[] = [];
      for (const item of items) {
        const found = records.find((record) => record.id === item.productId.toLowerCase());
        if (!found || found.quantity < item.quantity) {
          await store.releaseStock(taken);
          return { ok: false, productId: item.productId };
        }
        found.quantity -= item.quantity;
        taken.push(item);
      }
      return { ok: true };
    },

    async releaseStock(items) {
      for (const item of items) {
        const found = records.find((record) => record.id === item.productId.toLowerCase());
        if (found) found.quantity += item.quantity;
      }
    },

    async upsertBySlug(data, quantityIfNew) {
      const existing = records.find((record) => record.slug === data.slug.toLowerCase());
      if (!existing) {
        await store.create(data, quantityIfNew);
        return "created";
      }
      await store.update(existing.id, data);
      return "updated";
    },

    all() {
      return structuredClone(records);
    },
  };

  return store;
}
