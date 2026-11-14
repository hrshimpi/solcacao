// Calls for the products API. The server answers in the language we send, as planned for GET /api/products:
//   { items: [{ id, slug, name, caption, tastingSummary, price (whole cents), images: [url, ...], imageAlt? }], page, limit, total }
// Anything that does not look like that is left out, so one broken product cannot break the page.
import { ApiError, apiFetch } from "../lib/apiFetch";
import type { Lang } from "../i18n";

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
