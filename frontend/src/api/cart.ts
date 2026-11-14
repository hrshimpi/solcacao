// Calls for the cart API. The cart lives on the server: for a signed in person it belongs to the account, for a visitor to a
// cookie that scripts cannot read. Every call answers with the whole cart, so the page only ever shows what the server holds.
// The prices come from the server and are shown as they are (the API sends whole cents, the page works in dollars).
import type { Lang } from "../i18n";
import { api } from "../lib/api";
import { ApiError } from "../lib/apiFetch";

export type LineIssue = "unavailable" | "out_of_stock" | "over_stock";

export interface CartProduct {
  id: string;
  slug: string;
  name: string;
  thumbnail: string;
  imageAlt: string;
  // today's price in dollars, which can differ from the price of the line
  price: number;
  stock: number;
}

export interface CartLine {
  id: string;
  kind: "product" | "sampler";
  quantity: number;
  // in dollars, the price of the day the line was made
  unitPrice: number;
  lineTotal: number;
  // the most units the line can have right now
  available: number;
  issue: LineIssue | null;
  priceChanged: boolean;
  products: CartProduct[];
}

export interface Cart {
  lines: CartLine[];
  // the number of units
  itemCount: number;
  // in dollars, at the prices of the lines
  subtotal: number;
}

export const emptyCart: Cart = { lines: [], itemCount: 0, subtotal: 0 };

const text = (value: unknown) => (typeof value === "string" ? value : "");
const whole = (value: unknown) => (typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null);

function readProduct(raw: unknown): CartProduct | null {
  if (typeof raw !== "object" || raw === null) return null;
  const item = raw as Record<string, unknown>;
  const price = whole(item.price);
  const stock = whole(item.stock);
  if (!text(item.id) || !text(item.slug) || price === null || stock === null) return null;
  return { id: text(item.id), slug: text(item.slug), name: text(item.name), thumbnail: text(item.thumbnail), imageAlt: text(item.imageAlt), price: price / 100, stock };
}

function readLine(raw: unknown): CartLine | null {
  if (typeof raw !== "object" || raw === null) return null;
  const item = raw as Record<string, unknown>;
  const quantity = whole(item.quantity);
  const unitPrice = whole(item.unitPrice);
  const lineTotal = whole(item.lineTotal);
  const available = whole(item.available);
  if (!/^(p-[0-9a-f]{24}|s-[0-9a-f]{20})$/.test(text(item.lineId)) || quantity === null || quantity < 1 || unitPrice === null || lineTotal === null || available === null) return null;
  if (item.kind !== "product" && item.kind !== "sampler") return null;

  const issue = item.issue === "unavailable" || item.issue === "out_of_stock" || item.issue === "over_stock" ? item.issue : null;
  return {
    id: text(item.lineId),
    kind: item.kind,
    quantity,
    unitPrice: unitPrice / 100,
    lineTotal: lineTotal / 100,
    available,
    issue,
    priceChanged: item.priceChanged === true,
    products: (Array.isArray(item.products) ? item.products : []).map(readProduct).filter((product): product is CartProduct => product !== null),
  };
}

// the cart of an answer, or an ApiError when the answer is not a cart
export function readCart(body: unknown): Cart {
  const cart = typeof body === "object" && body !== null ? (body as { cart?: unknown }).cart : undefined;
  if (typeof cart !== "object" || cart === null || !Array.isArray((cart as { lines?: unknown }).lines)) throw new ApiError("The answer was not a cart.");

  const lines = (cart as { lines: unknown[] }).lines.map(readLine).filter((line): line is CartLine => line !== null);
  const subtotal = whole((cart as { subtotal?: unknown }).subtotal);
  return {
    lines,
    // what the page shows is worked out from the lines it could read, so the numbers always add up
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotal: subtotal !== null && lines.length === (cart as { lines: unknown[] }).lines.length ? subtotal / 100 : lines.reduce((sum, line) => sum + line.lineTotal, 0),
  };
}

type Options = { lang: Lang; signal?: AbortSignal };

export async function fetchCart({ lang, signal }: Options): Promise<Cart> {
  return readCart(await api.get<unknown>("/cart", { lang, signal }));
}

export async function addToCart(input: { kind: "product"; productId: string; quantity: number } | { kind: "sampler"; productIds: string[] }, { lang }: Options): Promise<Cart> {
  return readCart(await api.post<unknown>("/cart/items", { lang, json: input }));
}

export async function setLineQuantity(lineId: string, quantity: number, { lang }: Options): Promise<Cart> {
  return readCart(await api.patch<unknown>(`/cart/items/${lineId}`, { lang, json: { quantity } }));
}

export async function removeLine(lineId: string, { lang }: Options): Promise<Cart> {
  return readCart(await api.delete<unknown>(`/cart/items/${lineId}`, { lang }));
}

// after a sign in: the cart of the visitor goes into the cart of the person
export async function mergeCart({ lang }: Options): Promise<Cart> {
  return readCart(await api.post<unknown>("/cart/merge", { lang }));
}
