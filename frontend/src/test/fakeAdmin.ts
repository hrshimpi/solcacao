// The routes of the dashboard that are not about orders: the products of the staff routes and the inquiries. Same paths, same
// status codes and error codes as the real API, with the same rule: only an admin gets in.
import type { FakeCall, FakeServer } from "./fakeServer";
import { fixtureId, fixtureRecords } from "./productFixtures";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const failure = (status: number, code: string, message: string, details: unknown[] = []) => json({ error: { code, message, details } }, status);

export interface FakeInquiry {
  id: string;
  category: "general" | "wholesale" | "support" | "feedback" | "newsletter";
  status: "new" | "responded";
  name?: string;
  email?: string;
  message?: string;
  rating?: number;
  createdAt: string;
}

// a product as the staff routes send it: the text in both languages, the price in cents
function staffProduct(server: FakeServer, slug: string) {
  const record = fixtureRecords.find((entry) => entry.product.slug === slug);
  if (record) {
    const { product } = record;
    return {
      id: fixtureId(slug),
      slug,
      sku: product.sku,
      name: product.name,
      originName: product.originName,
      category: product.category,
      percentage: product.percentage,
      price: server.prices.get(slug) ?? product.price,
      thumbnail: product.thumbnail,
      quantity: server.stock.get(slug) ?? 0,
      lowStockThreshold: 10,
      active: !server.inactive.has(slug),
      featured: product.featured,
    };
  }
  const made = server.createdProducts.find((entry) => entry.slug === slug);
  return made ? { ...made, quantity: server.stock.get(slug) ?? 0, lowStockThreshold: 10, active: !server.inactive.has(slug) } : undefined;
}

export function adminRoute(server: FakeServer, call: FakeCall, path: string, input: Record<string, unknown>): Response | undefined {
  const staff = path === "/api/staff/products" || path.startsWith("/api/staff/products/");
  const inquiries = (path === "/api/inquiries" && call.method === "GET") || (path.startsWith("/api/inquiries/") && call.method === "PATCH");
  if (!staff && !inquiries) return undefined;

  if (!call.headers.authorization) return failure(401, "UNAUTHENTICATED", "Please sign in to do that.");
  const who = server.tokenOf;
  if (!who) return failure(401, "TOKEN_EXPIRED", "Your session ran out. Please sign in again.");
  if (who.role !== "admin") return failure(403, "FORBIDDEN", "You don't have access to that.");
  const query = new URL(call.path, "http://localhost").searchParams;
  const { method } = call;

  if (inquiries) {
    if (method === "GET") {
      const status = query.get("status");
      const found = [...server.inquiryRecords].reverse().filter((entry) => !status || entry.status === status);
      const number = Math.max(1, Number(query.get("page") ?? 1) || 1);
      const limit = Math.max(1, Number(query.get("limit") ?? 20) || 20);
      return json({ items: found.slice((number - 1) * limit, number * limit), page: number, limit, total: found.length });
    }
    const entry = server.inquiryRecords.find((item) => path === `/api/inquiries/${item.id}`);
    if (!entry) return failure(404, "NOT_FOUND", "That inquiry doesn't exist.");
    if (input.status !== "new" && input.status !== "responded") return failure(400, "VALIDATION_ERROR", "Status must be new or responded.", [{ field: "status", message: "bad" }]);
    entry.status = input.status;
    return json(entry);
  }

  const slugs = [...fixtureRecords.map((record) => record.product.slug), ...server.createdProducts.map((entry) => String(entry.slug))];

  if (method === "GET" && path === "/api/staff/products") {
    const items = slugs.map((slug) => staffProduct(server, slug));
    return json({ items, page: 1, limit: 48, total: items.length });
  }

  if (method === "POST" && path === "/api/staff/products") {
    const slug = String(input.slug ?? "");
    if (slugs.includes(slug)) return failure(409, "SLUG_TAKEN", "A product with that slug already exists.");
    if ([...fixtureRecords.map((record) => record.product.sku), ...server.createdProducts.map((entry) => String(entry.sku))].includes(String(input.sku ?? ""))) return failure(409, "SKU_TAKEN", "A product with that SKU already exists.");
    const id = `64b7f0c2a1b2c3d4e5f60b${(server.createdProducts.length + 10).toString(16).padStart(2, "0")}`;
    const { quantity, ...product } = input;
    server.createdProducts.push({ ...product, id });
    server.stock.set(slug, Number(quantity ?? 0));
    server.createdBodies.push(input);
    return json({ product: staffProduct(server, slug) }, 201);
  }

  const one = /^\/api\/staff\/products\/([0-9a-f]{24})(\/inventory)?$/.exec(path);
  if (one) {
    const slug = slugs.find((candidate) => staffProduct(server, candidate)?.id === one[1]);
    if (!slug) return failure(404, "NOT_FOUND", "That product wasn't found.");
    if (method === "PATCH" && !one[2]) {
      if (typeof input.price === "number") server.prices.set(slug, input.price);
      if (typeof input.active === "boolean") {
        if (input.active) server.inactive.delete(slug);
        else server.inactive.add(slug);
      }
      return json({ product: staffProduct(server, slug) });
    }
    if (method === "PUT" && one[2]) {
      if (typeof input.quantity !== "number" || input.quantity < 0) return failure(400, "VALIDATION_ERROR", "quantity can't be negative.", [{ field: "quantity", message: "bad" }]);
      server.stock.set(slug, input.quantity);
      return json({ product: staffProduct(server, slug) });
    }
  }
  return undefined;
}
