// Calls for the products API. The server answers in the language we send:
//   { items: [{ id, slug, name, caption, tastingSummary, price (whole cents), images: [url, ...], ... }], page, limit, total }
// Anything that does not look like that is left out, so one broken product cannot break the page.
import { ApiError, apiFetch } from "../lib/apiFetch";
import type { Lang } from "../i18n";

export type Category = "bar" | "truffle" | "seasonal";
export type NoteId = "fruity" | "nutty" | "floral" | "earthy" | "smoky";

export const categoryIds: Category[] = ["bar", "truffle", "seasonal"];
export const noteIds: NoteId[] = ["fruity", "nutty", "floral", "earthy", "smoky"];

// a product as the shop shows it, in the language that was asked for
export interface Product {
  id: string;
  slug: string;
  name: string;
  // the id of the origin (like "peru") and its name in the language of the page
  origin: string;
  originName: string;
  percentage: number;
  category: Category;
  // in dollars (the API sends whole cents)
  price: number;
  // units we can sell right now, 0 means sold out
  stock: number;
  notes: NoteId[];
  caption: string;
  tastingSummary: string;
  // the small picture of a card, the first big picture, and all the pictures of the product page
  image: string;
  imageLarge: string;
  images: string[];
  imageAlt: string;
  batchCode: string;
  harvestMonth: string;
  roastMonth: string;
  farm: string;
  description: string;
}

// what the home page shows for one featured product
export interface FeaturedProduct {
  id: string;
  slug: string;
  name: string;
  // the short line under the name: the tasting summary, or the caption when there is none
  flavor: string;
  // in dollars (the API sends cents), null when the API sent no price
  price: number | null;
  image: string;
  imageAlt: string;
}

export const FEATURED_COUNT = 5;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// a web address or a path on our own site, nothing else (no javascript: or data: links)
function isSafeImage(url: string): boolean {
  return /^(https?:\/\/|\/)/i.test(url) && !/[\s"'<>]/.test(url);
}

function toFeaturedProduct(raw: unknown): FeaturedProduct | null {
  if (typeof raw !== "object" || raw === null) return null;
  const item = raw as Record<string, unknown>;

  const slug = text(item.slug);
  const name = text(item.name);
  // the slug ends up in a link, so only the simple lower case form we use is accepted
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/i.test(slug) || name === "") return null;

  const firstImage = Array.isArray(item.images) ? text(item.images[0]) : text(item.image);
  const cents = typeof item.price === "number" && Number.isFinite(item.price) && item.price >= 0 ? item.price : null;

  return {
    id: text(item.id) || slug,
    slug,
    name,
    flavor: text(item.tastingSummary) || text(item.caption),
    price: cents === null ? null : cents / 100,
    image: isSafeImage(firstImage) ? firstImage : "",
    imageAlt: text(item.imageAlt),
  };
}

export async function fetchFeaturedProducts(lang: Lang, signal?: AbortSignal): Promise<FeaturedProduct[]> {
  const body = await apiFetch<unknown>("/products", { lang, query: { featured: true, limit: FEATURED_COUNT }, signal });

  const list = Array.isArray(body) ? body : (body as { items?: unknown } | null)?.items;
  if (!Array.isArray(list)) throw new ApiError("The product list has an unexpected shape.");

  return list
    .map(toFeaturedProduct)
    .filter((product): product is FeaturedProduct => product !== null)
    .slice(0, FEATURED_COUNT);
}

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

// one product of the list, or null when it is not in the shape we know
export function toProduct(raw: unknown): Product | null {
  if (typeof raw !== "object" || raw === null) return null;
  const item = raw as Record<string, unknown>;

  const slug = text(item.slug);
  const name = text(item.name);
  const id = text(item.id);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/i.test(slug) || name === "" || id === "") return null;

  const category = item.category as Category;
  if (!categoryIds.includes(category)) return null;

  const cents = item.price;
  const percentage = item.percentage;
  const stock = item.stock;
  if (typeof cents !== "number" || !Number.isFinite(cents) || cents < 0) return null;
  if (typeof percentage !== "number" || !Number.isFinite(percentage)) return null;
  if (typeof stock !== "number" || !Number.isInteger(stock) || stock < 0) return null;

  const images = (Array.isArray(item.images) ? item.images : []).map(text).filter(isSafeImage);
  const thumbnail = text(item.thumbnail);
  const image = isSafeImage(thumbnail) ? thumbnail : (images[0] ?? "");

  return {
    id,
    slug,
    name,
    origin: text(item.origin),
    originName: text(item.originName) || text(item.origin),
    percentage,
    category,
    price: cents / 100,
    stock,
    notes: (Array.isArray(item.notes) ? item.notes : []).filter((note): note is NoteId => noteIds.includes(note as NoteId)),
    caption: text(item.caption),
    tastingSummary: text(item.tastingSummary),
    image,
    imageLarge: images[0] ?? image,
    images: images.length > 0 ? images : image ? [image] : [],
    imageAlt: text(item.imageAlt),
    batchCode: text(item.batchCode),
    harvestMonth: monthPattern.test(text(item.harvestMonth)) ? text(item.harvestMonth) : "",
    roastMonth: monthPattern.test(text(item.roastMonth)) ? text(item.roastMonth) : "",
    farm: text(item.farm),
    description: text(item.description),
  };
}

// The whole shop in one language, at most 48 products (what one page of the API holds). The shop page filters them on the
// screen, so moving a slider does not wait for the server.
export async function fetchProducts(lang: Lang, signal?: AbortSignal): Promise<Product[]> {
  const body = await apiFetch<unknown>("/products", { lang, query: { limit: 48, sort: "featured" }, signal });

  const list = typeof body === "object" && body !== null ? (body as { items?: unknown }).items : undefined;
  if (!Array.isArray(list)) throw new ApiError("The product list has an unexpected shape.");

  return list.map(toProduct).filter((product): product is Product => product !== null);
}
