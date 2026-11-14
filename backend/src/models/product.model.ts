// The Product model: one thing we sell. Every text a shopper reads is kept in English and Spanish ({ en, es }),
// money is whole cents, and the stock is not here: it lives in the Inventory model, one document for each product.
import { model, Schema, type HydratedDocument } from "mongoose";
import { jsonPlugin } from "../plugins/json.plugin.ts";

export const productCategories = ["bar", "truffle", "seasonal"] as const;
export const tastingNotes = ["fruity", "nutty", "floral", "earthy", "smoky"] as const;
export const productOrigins = ["ecuador", "peru", "venezuela", "colombia", "madagascar"] as const;

// the ways the shop can order a list of products
export const productSorts = ["featured", "price_asc", "price_desc", "pct_desc", "newest"] as const;

export type ProductSort = (typeof productSorts)[number];
export type ProductCategory = (typeof productCategories)[number];
export type TastingNote = (typeof tastingNotes)[number];
export type ProductOrigin = (typeof productOrigins)[number];

export interface BilingualText {
  en: string;
  es: string;
}

export interface ProductData {
  // the address of the product page, like "ecuador-72"
  slug: string;
  sku: string;
  name: BilingualText;
  caption: BilingualText;
  tastingSummary: BilingualText;
  imageAlt: BilingualText;
  farm: BilingualText;
  description: BilingualText;
  origin: ProductOrigin;
  // the name of the country in each language
  originName: BilingualText;
  // cacao percentage, a whole number from 1 to 100
  percentage: number;
  category: ProductCategory;
  // whole cents
  price: number;
  notes: TastingNote[];
  // the small picture for cards and lists, and the pictures of the product page
  thumbnail: string;
  images: string[];
  batchCode: string;
  // like 2024-03
  harvestMonth: string;
  roastMonth: string;
  featured: boolean;
  // a product that is not active is not shown in the shop, but its history stays
  active: boolean;
  // the place in the shop when nothing else decides the order
  sortOrder: number;
  // the names and origin in both languages, in lower case and without accents, for the search box
  searchText: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ProductDocument = HydratedDocument<ProductData>;

// letters, numbers and spaces, no accents and no capitals: what a search compares
export function searchable(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function searchTextOf(product: Pick<ProductData, "name" | "caption" | "originName" | "origin" | "category">): string {
  return [product.name.en, product.name.es, product.caption.en, product.caption.es, product.originName.en, product.originName.es, product.origin, product.category]
    .map(searchable)
    .join(" ");
}

const text = (max: number) => ({
  en: { type: String, required: true, trim: true, minlength: 1, maxlength: max },
  es: { type: String, required: true, trim: true, minlength: 1, maxlength: max },
});

// a web address or a path on our own site, nothing else (no javascript: or data: links)
const imagePattern = /^(https:\/\/|\/)[^\s"'<>]+$/i;

const productSchema = new Schema<ProductData>(
  {
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 80, match: [/^[a-z0-9]+(-[a-z0-9]+)*$/, "{PATH} must be lower case words joined with dashes"] },
    sku: { type: String, required: true, trim: true, uppercase: true, maxlength: 40, match: [/^[A-Z0-9][A-Z0-9-]*$/, "{PATH} can only have capitals, numbers and dashes"] },
    name: text(80),
    caption: text(120),
    tastingSummary: text(160),
    imageAlt: text(200),
    farm: text(120),
    description: text(2000),
    origin: { type: String, required: true, enum: productOrigins },
    originName: text(80),
    percentage: { type: Number, required: true, min: 1, max: 100, validate: { validator: Number.isInteger, message: "{PATH} must be a whole number" } },
    category: { type: String, required: true, enum: productCategories },
    price: { type: Number, required: true, min: 1, validate: { validator: Number.isInteger, message: "{PATH} must be a whole number of cents" } },
    notes: { type: [{ type: String, enum: tastingNotes }], default: [] },
    thumbnail: { type: String, required: true, maxlength: 500, match: [imagePattern, "{PATH} must be a web address or a path"] },
    images: {
      type: [{ type: String, match: [imagePattern, "{PATH} must be a web address or a path"], maxlength: 500 }],
      validate: { validator: (images: string[]) => images.length >= 1 && images.length <= 8, message: "{PATH} needs between 1 and 8 images" },
    },
    batchCode: { type: String, required: true, trim: true, maxlength: 40 },
    harvestMonth: { type: String, required: true, match: [/^\d{4}-(0[1-9]|1[0-2])$/, "{PATH} must look like 2024-03"] },
    roastMonth: { type: String, required: true, match: [/^\d{4}-(0[1-9]|1[0-2])$/, "{PATH} must look like 2024-03"] },
    featured: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    searchText: { type: String, default: "", select: false, private: true },
  },
  { timestamps: true },
);

productSchema.index({ slug: 1 }, { unique: true });
productSchema.index({ sku: 1 }, { unique: true });
// the shop lists what is active, with the featured ones first
productSchema.index({ active: 1, featured: -1, sortOrder: 1 });
productSchema.index({ active: 1, origin: 1 });
productSchema.index({ active: 1, category: 1 });
productSchema.index({ active: 1, percentage: 1 });
productSchema.index({ active: 1, price: 1 });

// the search text follows the names, so it can never be out of date
productSchema.pre("validate", function () {
  if (this.name && this.caption && this.originName) this.searchText = searchTextOf(this);
});

productSchema.plugin(jsonPlugin);

export const Product = model<ProductData>("Product", productSchema);
