// Where the products and their stock are kept. Like the other stores, the services only talk to this interface, so
// the tests can use a store in memory and the real server uses MongoDB. A product always comes with its stock
// (from the Inventory model), and with its text in both languages: choosing a language is the job of the service.
import mongoose from "mongoose";
import { requireDatabase } from "../config/db.ts";
import { AppError } from "../errors/AppError.ts";
import { Inventory } from "../models/inventory.model.ts";
import { Product, searchable, type BilingualText, type ProductCategory, type ProductData, type ProductDocument, type ProductOrigin, type ProductSort, type TastingNote } from "../models/product.model.ts";
import { DEFAULT_LOW_STOCK } from "./stock.ts";
import { objectIdPattern } from "./user.store.ts";

export interface StoredProduct {
  id: string;
  slug: string;
  sku: string;
  name: BilingualText;
  caption: BilingualText;
  tastingSummary: BilingualText;
  imageAlt: BilingualText;
  farm: BilingualText;
  description: BilingualText;
  origin: ProductOrigin;
  originName: BilingualText;
  percentage: number;
  category: ProductCategory;
  // whole cents
  price: number;
  notes: TastingNote[];
  thumbnail: string;
  images: string[];
  batchCode: string;
  harvestMonth: string;
  roastMonth: string;
  featured: boolean;
  active: boolean;
  sortOrder: number;
  quantity: number;
  lowStockThreshold: number;
  createdAt: string;
  updatedAt: string;
}

// what makes a product (the search text is made by the model, the stock is given on its own)
export type NewProduct = Omit<ProductData, "searchText" | "createdAt" | "updatedAt">;

// what a change can carry: any part of a product, and a bilingual text is replaced as a whole
export type ProductChange = Partial<NewProduct>;

export interface ProductQuery {
  // part of a name or of the origin, in any case and with or without accents
  q?: string;
  origins?: ProductOrigin[];
  categories?: ProductCategory[];
  minPct?: number;
  maxPct?: number;
  // a product matches when it has any of these notes
  notes?: TastingNote[];
  featured?: boolean;
  sort: ProductSort;
  page: number;
  limit: number;
  // for the team: also the products that are switched off
  includeInactive?: boolean;
}

export interface Visibility {
  includeInactive?: boolean;
}

export interface ProductStore {
  list(query: ProductQuery): Promise<{ items: StoredProduct[]; total: number }>;
  findBySlug(slug: string, visibility?: Visibility): Promise<StoredProduct | null>;
  findById(id: string, visibility?: Visibility): Promise<StoredProduct | null>;
  // in the order of the ids, leaving out the ones that are not there
  findByIds(ids: string[], visibility?: Visibility): Promise<StoredProduct[]>;
  // products of the same category or the same origin, never the product itself
  related(product: StoredProduct, limit: number): Promise<StoredProduct[]>;
  // fails with SLUG_TAKEN or SKU_TAKEN (409) when one of them is used by another product
  create(data: NewProduct, quantity: number): Promise<StoredProduct>;
  update(id: string, change: ProductChange): Promise<StoredProduct | null>;
  // sets the stock to the given number, and the threshold for "low stock" when it is given
  setInventory(id: string, stock: { quantity: number; lowStockThreshold?: number }): Promise<StoredProduct | null>;
  // for the seed: makes the product when its slug is new, changes it when it is not. The stock is only set for a new
  // product, so running the seed again never puts the numbers back.
  upsertBySlug(data: NewProduct, quantityIfNew: number): Promise<"created" | "updated">;
}

export const slugTaken = () => new AppError("SLUG_TAKEN", 409, "A product with that slug already exists.");
export const skuTaken = () => new AppError("SKU_TAKEN", 409, "A product with that SKU already exists.");

// what a search compares: a part of a word is enough, and the text of the person is never read as a pattern
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// the parts of a product that a change can set, whatever else it carries (the search text, the dates, the id...)
export const editableFields = [
  "slug", "sku", "name", "caption", "tastingSummary", "imageAlt", "farm", "description", "origin", "originName", "percentage",
  "category", "price", "notes", "thumbnail", "images", "batchCode", "harvestMonth", "roastMonth", "featured", "active", "sortOrder",
] as const satisfies readonly (keyof NewProduct)[];

export function onlyEditable(change: ProductChange): ProductChange {
  return Object.fromEntries(editableFields.filter((field) => change[field] !== undefined).map((field) => [field, change[field]]));
}

const sortSpecs: Record<ProductSort, Record<string, 1 | -1>> = {
  featured: { featured: -1, sortOrder: 1, _id: 1 },
  price_asc: { price: 1, sortOrder: 1, _id: 1 },
  price_desc: { price: -1, sortOrder: 1, _id: 1 },
  pct_desc: { percentage: -1, sortOrder: 1, _id: 1 },
  newest: { createdAt: -1, sortOrder: 1, _id: 1 },
};

function toStored(doc: ProductDocument, stock?: { quantity: number; lowStockThreshold: number }): StoredProduct {
  const plain = (text: BilingualText): BilingualText => ({ en: text.en, es: text.es });
  return {
    id: String(doc._id),
    slug: doc.slug,
    sku: doc.sku,
    name: plain(doc.name),
    caption: plain(doc.caption),
    tastingSummary: plain(doc.tastingSummary),
    imageAlt: plain(doc.imageAlt),
    farm: plain(doc.farm),
    description: plain(doc.description),
    origin: doc.origin,
    originName: plain(doc.originName),
    percentage: doc.percentage,
    category: doc.category,
    price: doc.price,
    notes: [...doc.notes],
    thumbnail: doc.thumbnail,
    images: [...doc.images],
    batchCode: doc.batchCode,
    harvestMonth: doc.harvestMonth,
    roastMonth: doc.roastMonth,
    featured: doc.featured,
    active: doc.active,
    sortOrder: doc.sortOrder,
    quantity: stock?.quantity ?? 0,
    lowStockThreshold: stock?.lowStockThreshold ?? DEFAULT_LOW_STOCK,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

// puts the stock of each product with the product, in the order of the products
async function withStock(docs: ProductDocument[]): Promise<StoredProduct[]> {
  if (docs.length === 0) return [];
  const stock = await Inventory.find({ productId: mongoose.trusted({ $in: docs.map((doc) => doc._id) }) });
  const byProduct = new Map(stock.map((entry) => [String(entry.productId), { quantity: entry.quantity, lowStockThreshold: entry.lowStockThreshold }]));
  return docs.map((doc) => toStored(doc, byProduct.get(String(doc._id))));
}

function filterFor(query: Pick<ProductQuery, "q" | "origins" | "categories" | "minPct" | "maxPct" | "notes" | "featured" | "includeInactive">) {
  const filter: Record<string, unknown> = {};
  if (!query.includeInactive) filter.active = true;
  if (query.origins?.length) filter.origin = mongoose.trusted({ $in: query.origins });
  if (query.categories?.length) filter.category = mongoose.trusted({ $in: query.categories });
  if (query.minPct !== undefined || query.maxPct !== undefined) {
    filter.percentage = mongoose.trusted({ ...(query.minPct !== undefined ? { $gte: query.minPct } : {}), ...(query.maxPct !== undefined ? { $lte: query.maxPct } : {}) });
  }
  if (query.notes?.length) filter.notes = mongoose.trusted({ $in: query.notes });
  if (query.featured !== undefined) filter.featured = query.featured;
  if (query.q) {
    const needle = searchable(query.q);
    // what is typed can be nothing but accents (like "^"), which is a search for nothing and finds nothing
    if (needle === "") filter._id = mongoose.trusted({ $in: [] });
    else filter.searchText = mongoose.trusted({ $regex: escapeRegex(needle) });
  }
  return filter;
}

export function createMongoProductStore(): ProductStore {
  async function one(filter: Record<string, unknown>): Promise<StoredProduct | null> {
    const doc = await Product.findOne(filter);
    return doc ? (await withStock([doc]))[0] : null;
  }

  // the duplicate key error of the unique indexes, as the answer that says which one it was
  function explain(error: unknown): never {
    const duplicate = error as { code?: number; keyPattern?: Record<string, unknown> };
    if (duplicate.code === 11000) throw duplicate.keyPattern && "sku" in duplicate.keyPattern ? skuTaken() : slugTaken();
    throw error;
  }

  const store: ProductStore = {
    async list(query) {
      requireDatabase();
      const filter = filterFor(query);
      const [docs, total] = await Promise.all([
        Product.find(filter)
          .sort(sortSpecs[query.sort])
          .skip((query.page - 1) * query.limit)
          .limit(query.limit),
        Product.countDocuments(filter),
      ]);
      return { items: await withStock(docs), total };
    },

    async findBySlug(slug, { includeInactive = false } = {}) {
      requireDatabase();
      if (typeof slug !== "string") return null;
      return one({ slug: slug.toLowerCase(), ...(includeInactive ? {} : { active: true }) });
    },

    async findById(id, { includeInactive = false } = {}) {
      requireDatabase();
      if (!objectIdPattern.test(id)) return null;
      return one({ _id: id, ...(includeInactive ? {} : { active: true }) });
    },

    async findByIds(ids, { includeInactive = false } = {}) {
      requireDatabase();
      const valid = [...new Set(ids)].filter((id) => objectIdPattern.test(id));
      if (valid.length === 0) return [];
      const docs = await Product.find({ _id: mongoose.trusted({ $in: valid }), ...(includeInactive ? {} : { active: true }) });
      const found = await withStock(docs);
      return valid.map((id) => found.find((product) => product.id === id.toLowerCase())).filter((product): product is StoredProduct => product !== undefined);
    },

    async related(product, limit) {
      requireDatabase();
      const docs = await Product.find({
        active: true,
        _id: mongoose.trusted({ $ne: new mongoose.Types.ObjectId(product.id) }),
        $or: [{ category: product.category }, { origin: product.origin }],
      })
        .sort({ sortOrder: 1, _id: 1 })
        .limit(limit);
      return withStock(docs);
    },

    async create(data, quantity) {
      requireDatabase();
      try {
        const doc = await Product.create(data);
        try {
          await Inventory.create({ productId: doc._id, quantity });
        } catch (error) {
          // a product without its stock row would show as sold out for good, so it is not kept
          await Product.deleteOne({ _id: doc._id });
          throw error;
        }
        return (await withStock([doc]))[0];
      } catch (error) {
        return explain(error);
      }
    },

    async update(id, change) {
      requireDatabase();
      if (!objectIdPattern.test(id)) return null;
      try {
        // saving the document (and not updating with an operator) lets the model make the search text again
        const doc = await Product.findById(id);
        if (!doc) return null;
        doc.set(onlyEditable(change));
        await doc.save();
        return (await withStock([doc]))[0];
      } catch (error) {
        return explain(error);
      }
    },

    async setInventory(id, { quantity, lowStockThreshold }) {
      requireDatabase();
      if (!objectIdPattern.test(id)) return null;
      const doc = await Product.findById(id);
      if (!doc) return null;
      await Inventory.updateOne({ productId: doc._id }, { $set: { quantity, ...(lowStockThreshold !== undefined ? { lowStockThreshold } : {}) } }, { upsert: true, runValidators: true });
      return (await withStock([doc]))[0];
    },

    async upsertBySlug(data, quantityIfNew) {
      requireDatabase();
      const existing = await Product.findOne({ slug: data.slug });
      if (!existing) {
        await store.create(data, quantityIfNew);
        return "created";
      }
      existing.set(onlyEditable(data));
      await existing.save();
      // a product that was made before the stock row existed gets one, with the stock of the seed
      await Inventory.updateOne({ productId: existing._id }, { $setOnInsert: { quantity: quantityIfNew } }, { upsert: true });
      return "updated";
    },
  };

  return store;
}
