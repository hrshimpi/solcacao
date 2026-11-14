// Calls for the dashboard of the team. They need the token of an admin (the server answers 403 to anybody else). Money comes as
// whole cents on the wire and is dollars in the page, like everywhere else.
import type { Lang } from "../i18n";
import { api } from "../lib/api";
import { ApiError } from "../lib/apiFetch";
import { orderStatuses, readOrder, readOrderAnswer, readOrderPage, type Order, type OrderPage, type OrderStatus } from "./orders";

type Options = { lang: Lang; signal?: AbortSignal };

const record = (value: unknown): Record<string, unknown> | null => (typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null);
const text = (value: unknown) => (typeof value === "string" ? value : "");
const whole = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0);

// ---- the numbers of the dashboard

export interface AdminStats {
  orders: number;
  // in dollars, without the orders that were cancelled
  revenue: number;
  averageOrder: number;
  byStatus: Record<OrderStatus, number>;
  today: { orders: number; revenue: number };
  customers: number;
  products: number;
  lowStock: { id: string; slug: string; name: string; quantity: number }[];
  recentOrders: Order[];
}

export async function fetchAdminStats({ lang, signal }: Options): Promise<AdminStats> {
  const body = record(await api.get<unknown>("/admin/stats", { lang, signal }));
  const byStatus = record(body?.byStatus);
  const today = record(body?.today);
  if (!body || !byStatus || !today || typeof body.orders !== "number") throw new ApiError("The answer was not the numbers of the dashboard.");

  return {
    orders: whole(body.orders),
    revenue: whole(body.revenue) / 100,
    averageOrder: whole(body.averageOrder) / 100,
    byStatus: Object.fromEntries(orderStatuses.map((status) => [status, whole(byStatus[status])])) as Record<OrderStatus, number>,
    today: { orders: whole(today.orders), revenue: whole(today.revenue) / 100 },
    customers: whole(body.customers),
    products: whole(body.products),
    lowStock: (Array.isArray(body.lowStock) ? body.lowStock : []).flatMap((entry) => {
      const item = record(entry);
      return item && text(item.id) ? [{ id: text(item.id), slug: text(item.slug), name: text(item.name), quantity: whole(item.quantity) }] : [];
    }),
    recentOrders: (Array.isArray(body.recentOrders) ? body.recentOrders : []).map(readOrder).filter((order): order is Order => order !== null),
  };
}

// ---- the orders of everybody

export async function fetchAdminOrders({ status, q, page, limit = 15, lang, signal }: Options & { status?: OrderStatus; q?: string; page: number; limit?: number }): Promise<OrderPage> {
  return readOrderPage(await api.get<unknown>("/admin/orders", { lang, signal, query: { page, limit, status, q: q?.trim() || undefined } }));
}

export async function fetchAdminOrder(id: string, { lang, signal }: Options): Promise<Order> {
  return readOrderAnswer(await api.get<unknown>(`/admin/orders/${id}`, { lang, signal }));
}

export async function setOrderStatus(id: string, status: OrderStatus, { lang }: Options): Promise<Order> {
  return readOrderAnswer(await api.patch<unknown>(`/admin/orders/${id}`, { lang, json: { status } }));
}

// ---- the products (the staff routes, which also take the token of an admin)

export interface AdminProduct {
  id: string;
  slug: string;
  sku: string;
  name: string;
  originName: string;
  category: string;
  percentage: number;
  // in dollars
  price: number;
  thumbnail: string;
  quantity: number;
  lowStockThreshold: number;
  active: boolean;
  featured: boolean;
}

function readBilingual(value: unknown, lang: Lang): string {
  const pair = record(value);
  return text(pair?.[lang]) || text(pair?.en);
}

export function readAdminProduct(raw: unknown, lang: Lang): AdminProduct | null {
  const item = record(raw);
  if (!item || !text(item.id) || !text(item.slug) || typeof item.price !== "number" || typeof item.quantity !== "number") return null;
  return {
    id: text(item.id),
    slug: text(item.slug),
    sku: text(item.sku),
    name: readBilingual(item.name, lang),
    originName: readBilingual(item.originName, lang),
    category: text(item.category),
    percentage: whole(item.percentage),
    price: item.price / 100,
    thumbnail: text(item.thumbnail),
    quantity: whole(item.quantity),
    lowStockThreshold: typeof item.lowStockThreshold === "number" ? item.lowStockThreshold : 10,
    active: item.active !== false,
    featured: item.featured === true,
  };
}

export async function fetchAdminProducts({ lang, signal }: Options): Promise<{ items: AdminProduct[]; total: number }> {
  const body = record(await api.get<unknown>("/staff/products", { lang, signal, query: { limit: 48, sort: "featured" } }));
  if (!body || !Array.isArray(body.items)) throw new ApiError("The answer was not a list of products.");
  return { items: body.items.map((item) => readAdminProduct(item, lang)).filter((product): product is AdminProduct => product !== null), total: whole(body.total) };
}

function readProductAnswer(body: unknown, lang: Lang): AdminProduct {
  const product = readAdminProduct(record(body)?.product, lang);
  if (!product) throw new ApiError("The answer was not a product.");
  return product;
}

// price in dollars here, cents on the wire
export async function updateProduct(id: string, change: { price?: number; active?: boolean }, { lang }: Options): Promise<AdminProduct> {
  const json = { ...(change.price !== undefined ? { price: Math.round(change.price * 100) } : {}), ...(change.active !== undefined ? { active: change.active } : {}) };
  return readProductAnswer(await api.patch<unknown>(`/staff/products/${id}`, { lang, json }), lang);
}

export async function setStock(id: string, quantity: number, { lang }: Options): Promise<AdminProduct> {
  return readProductAnswer(await api.put<unknown>(`/staff/products/${id}/inventory`, { lang, json: { quantity } }), lang);
}

// what the form of a new product sends, as the server wants it (the schema is in backend/src/schemas/product.schema.ts)
export interface NewProductBody {
  slug: string;
  sku: string;
  name: { en: string; es: string };
  caption: { en: string; es: string };
  tastingSummary: { en: string; es: string };
  imageAlt: { en: string; es: string };
  farm: { en: string; es: string };
  description: { en: string; es: string };
  origin: string;
  originName: { en: string; es: string };
  percentage: number;
  category: string;
  // whole cents
  price: number;
  notes: string[];
  thumbnail: string;
  images: string[];
  batchCode: string;
  harvestMonth: string;
  roastMonth: string;
  featured: boolean;
  quantity: number;
}

export async function createProduct(body: NewProductBody, { lang }: Options): Promise<AdminProduct> {
  return readProductAnswer(await api.post<unknown>("/staff/products", { lang, json: body }), lang);
}

// ---- the inquiries of the contact form

export type InquiryStatus = "new" | "responded";
export type InquiryCategory = "general" | "wholesale" | "support" | "feedback" | "newsletter";

export interface Inquiry {
  id: string;
  category: InquiryCategory;
  status: InquiryStatus;
  name: string;
  email: string;
  message: string;
  rating: number | null;
  createdAt: string;
}

const categories: InquiryCategory[] = ["general", "wholesale", "support", "feedback", "newsletter"];

function readInquiry(raw: unknown): Inquiry | null {
  const item = record(raw);
  if (!item || !text(item.id) || !categories.includes(item.category as InquiryCategory)) return null;
  return {
    id: text(item.id),
    category: item.category as InquiryCategory,
    status: item.status === "responded" ? "responded" : "new",
    name: text(item.name),
    email: text(item.email),
    message: text(item.message),
    rating: typeof item.rating === "number" ? item.rating : null,
    createdAt: text(item.createdAt),
  };
}

export async function fetchInquiries({ status, page, limit = 15, lang, signal }: Options & { status?: InquiryStatus; page: number; limit?: number }): Promise<{ items: Inquiry[]; total: number }> {
  const body = record(await api.get<unknown>("/inquiries", { lang, signal, query: { page, limit, status } }));
  if (!body || !Array.isArray(body.items)) throw new ApiError("The answer was not a list of inquiries.");
  return { items: body.items.map(readInquiry).filter((inquiry): inquiry is Inquiry => inquiry !== null), total: whole(body.total) };
}

export async function setInquiryStatus(id: string, status: InquiryStatus, { lang }: Options): Promise<Inquiry> {
  const inquiry = readInquiry(await api.patch<unknown>(`/inquiries/${id}`, { lang, json: { status } }));
  if (!inquiry) throw new ApiError("The answer was not an inquiry.");
  return inquiry;
}
