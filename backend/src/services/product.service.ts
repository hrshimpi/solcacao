// The shop as the people of the site see it: products with their text in one language, their price in cents and
// how many are left. The team's calls (make, change, set the stock) work on the whole product, in both languages.
import { AppError } from "../errors/AppError.ts";
import { localize, type Lang } from "../middleware/language.ts";
import type { ProductCategory, ProductOrigin, TastingNote } from "../models/product.model.ts";
import type { ProductCreateInput, ProductListQuery, ProductPatchInput } from "../schemas/product.schema.ts";
import type { ProductStore, StoredProduct } from "./product.store.ts";
import { availabilityOf, type Availability } from "./stock.ts";

// a product in one language, as the shop and the cart show it
export interface PublicProduct {
  id: string;
  slug: string;
  sku: string;
  name: string;
  caption: string;
  tastingSummary: string;
  imageAlt: string;
  farm: string;
  description: string;
  origin: ProductOrigin;
  originName: string;
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
  // units we can sell right now
  stock: number;
  availability: Availability;
}

export function toPublic(product: StoredProduct, lang: Lang): PublicProduct {
  return {
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    name: localize(product.name, lang),
    caption: localize(product.caption, lang),
    tastingSummary: localize(product.tastingSummary, lang),
    imageAlt: localize(product.imageAlt, lang),
    farm: localize(product.farm, lang),
    description: localize(product.description, lang),
    origin: product.origin,
    originName: localize(product.originName, lang),
    percentage: product.percentage,
    category: product.category,
    price: product.price,
    notes: product.notes,
    thumbnail: product.thumbnail,
    images: product.images,
    batchCode: product.batchCode,
    harvestMonth: product.harvestMonth,
    roastMonth: product.roastMonth,
    featured: product.featured,
    stock: product.quantity,
    availability: availabilityOf(product.quantity, product.lowStockThreshold),
  };
}

const notFound = () => new AppError("NOT_FOUND", 404, "That product wasn't found.");

export function createProductService({ products }: { products: ProductStore }) {
  return {
    async list(query: ProductListQuery, lang: Lang) {
      const { items, total } = await products.list({
        q: query.q,
        origins: query.origin,
        categories: query.category,
        minPct: query.minPct,
        maxPct: query.maxPct,
        notes: query.notes,
        featured: query.featured,
        sort: query.sort,
        page: query.page,
        limit: query.limit,
      });
      return { items: items.map((product) => toPublic(product, lang)), page: query.page, limit: query.limit, total };
    },

    async get(slug: string, lang: Lang): Promise<PublicProduct> {
      const product = await products.findBySlug(slug);
      if (!product) throw notFound();
      return toPublic(product, lang);
    },

    // up to four products of the same category or origin
    async related(slug: string, lang: Lang): Promise<PublicProduct[]> {
      const product = await products.findBySlug(slug);
      if (!product) throw notFound();
      return (await products.related(product, 4)).map((entry) => toPublic(entry, lang));
    },

    // for the team: everything, including the products that are switched off
    async staffList(query: ProductListQuery) {
      const { items, total } = await products.list({ ...query, origins: query.origin, categories: query.category, includeInactive: true });
      return { items, page: query.page, limit: query.limit, total };
    },

    async staffGet(id: string): Promise<StoredProduct> {
      const product = await products.findById(id, { includeInactive: true });
      if (!product) throw notFound();
      return product;
    },

    async create(input: ProductCreateInput): Promise<StoredProduct> {
      const { quantity, ...product } = input;
      return products.create(product, quantity);
    },

    async update(id: string, patch: ProductPatchInput): Promise<StoredProduct> {
      const product = await products.update(id, patch);
      if (!product) throw notFound();
      return product;
    },

    async setInventory(id: string, stock: { quantity: number; lowStockThreshold?: number }): Promise<StoredProduct> {
      const product = await products.setInventory(id, stock);
      if (!product) throw notFound();
      return product;
    },
  };
}

export type ProductService = ReturnType<typeof createProductService>;
