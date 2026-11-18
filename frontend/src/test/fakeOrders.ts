// The checkout, the orders and the dashboard of the fake server: the same paths, status codes and error codes as the real
// API (see backend/src/routes/orders.routes.ts and admin.routes.ts), with the same prices and the same rules, kept in memory.
import type { Lang } from "../i18n";
import type { FakeCall, FakeServer } from "./fakeServer";
import { fixtureId, fixtureRecords } from "./productFixtures";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const failure = (status: number, code: string, message: string, details: unknown[] = []) => json({ error: { code, message, details } }, status);

export type OrderStatus = "paid" | "processing" | "shipped" | "delivered" | "cancelled";

const next: Record<OrderStatus, OrderStatus[]> = { paid: ["processing", "cancelled"], processing: ["shipped", "cancelled"], shipped: ["delivered"], delivered: [], cancelled: [] };

export interface FakeOrder {
  id: string;
  number: string;
  userId: string;
  email: string;
  customerName: string;
  status: OrderStatus;
  lines: { kind: "product" | "sampler"; productIds: string[]; quantity: number; unitPrice: number; lineTotal: number }[];
  address: Record<string, unknown>;
  method: "standard" | "express";
  totals: { subtotal: number; shipping: number; tax: number; total: number };
  payment: { brand: string; last4: string; reference: string; status: "paid" | "refunded" };
  note: string | null;
  history: { status: OrderStatus; at: string }[];
  createdAt: string;
}

// ---- the prices, the same as backend/src/services/pricing.ts
export const shippingCents = (method: "standard" | "express", subtotal: number) => (method === "express" ? 1495 : subtotal >= 6000 ? 0 : 595);
export const taxCents = (subtotal: number) => Math.round(subtotal * 0.0825);
export const totalsOf = (subtotal: number, method: "standard" | "express") => {
  const shipping = shippingCents(method, subtotal);
  const tax = taxCents(subtotal);
  return { subtotal, shipping, tax, total: subtotal + shipping + tax };
};

const recordOf = (id: string) => fixtureRecords.find((record) => fixtureId(record.product.slug) === id);

function passesLuhn(number: string): boolean {
  if (!/^\d{12,19}$/.test(number)) return false;
  let sum = 0;
  for (let index = 0; index < number.length; index++) {
    let digit = Number(number[number.length - 1 - index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

const brandOf = (number: string) => (/^4/.test(number) ? "visa" : /^5[1-5]/.test(number) ? "mastercard" : /^3[47]/.test(number) ? "amex" : /^6/.test(number) ? "discover" : "card");

export function orderView(order: FakeOrder, lang: Lang) {
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    nextStatuses: next[order.status],
    canCancel: order.status === "paid",
    createdAt: order.createdAt,
    updatedAt: order.createdAt,
    lines: order.lines.map((line) => ({
      kind: line.kind,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
      products: line.productIds.flatMap((id) => {
        const record = recordOf(id);
        return record ? [{ id, slug: record.product.slug, name: record.product.name[lang], thumbnail: record.product.thumbnail, imageAlt: record.product.imageAlt[lang] }] : [];
      }),
    })),
    itemCount: order.lines.reduce((sum, line) => sum + line.quantity, 0),
    shippingAddress: order.address,
    shippingMethod: order.method,
    totals: order.totals,
    payment: { method: "card", ...order.payment },
    note: order.note,
    history: order.history,
    customer: { id: order.userId, email: order.email, name: order.customerName },
  };
}

// takes the units of an order back into the stock (a cancelled order)
function restock(server: FakeServer, order: FakeOrder) {
  for (const line of order.lines) {
    for (const id of line.productIds) {
      const record = recordOf(id);
      if (record) server.stock.set(record.product.slug, (server.stock.get(record.product.slug) ?? 0) + line.quantity);
    }
  }
}

function page<T>(items: T[], query: URLSearchParams, defaultLimit: number) {
  const number = Math.max(1, Number(query.get("page") ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.get("limit") ?? defaultLimit) || defaultLimit));
  return { items: items.slice((number - 1) * limit, number * limit), page: number, limit, total: items.length };
}

export function ordersRoute(server: FakeServer, call: FakeCall, path: string, input: Record<string, unknown>, lang: Lang): Response | undefined {
  const mine = path === "/api/checkout" || path === "/api/orders" || path.startsWith("/api/orders/");
  const admin = path === "/api/admin/stats" || path === "/api/admin/orders" || path.startsWith("/api/admin/orders/");
  if (!mine && !admin) return undefined;

  if (!call.headers.authorization) return failure(401, "UNAUTHENTICATED", "Please sign in to do that.");
  const who = server.tokenOf;
  if (!who) return failure(401, "TOKEN_EXPIRED", "Your session ran out. Please sign in again.");
  const { method } = call;
  const query = new URL(call.path, "http://localhost").searchParams;
  const cartKey = `user:${who.id}`;

  if (admin) {
    if (who.role !== "admin") return failure(403, "FORBIDDEN", "You don't have access to that.");
    const newestFirst = [...server.orders].reverse();

    if (method === "GET" && path === "/api/admin/stats") {
      const byStatus = { paid: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 };
      for (const order of server.orders) byStatus[order.status] += 1;
      const live = server.orders.filter((order) => order.status !== "cancelled");
      const revenue = live.reduce((sum, order) => sum + order.totals.total, 0);
      const lowStock = fixtureRecords
        .filter((record) => !server.inactive.has(record.product.slug) && (server.stock.get(record.product.slug) ?? 0) <= 10)
        .map((record) => ({ id: fixtureId(record.product.slug), slug: record.product.slug, name: record.product.name[lang], quantity: server.stock.get(record.product.slug) ?? 0, lowStockThreshold: 10 }))
        .sort((a, b) => a.quantity - b.quantity);
      return json({
        orders: server.orders.length,
        revenue,
        averageOrder: live.length > 0 ? Math.round(revenue / live.length) : 0,
        byStatus,
        today: { orders: server.orders.length, revenue },
        customers: server.accounts.length,
        products: fixtureRecords.length,
        lowStock,
        recentOrders: newestFirst.slice(0, 6).map((order) => orderView(order, lang)),
      });
    }

    if (method === "GET" && path === "/api/admin/orders") {
      const status = query.get("status");
      const needle = (query.get("q") ?? "").trim().toLowerCase();
      const found = newestFirst.filter((order) => (!status || order.status === status) && (!needle || [order.number, order.email, order.customerName].some((text) => text.toLowerCase().includes(needle))));
      const answer = page(found, query, 20);
      return json({ ...answer, items: answer.items.map((order) => orderView(order, lang)) });
    }

    const one = /^\/api\/admin\/orders\/([0-9a-f]{24})$/.exec(path);
    const order = one ? server.orders.find((entry) => entry.id === one[1]) : undefined;
    if (one && !order) return failure(404, "NOT_FOUND", "That order wasn't found.");
    if (one && order && method === "GET") return json({ order: orderView(order, lang) });
    if (one && order && method === "PATCH") {
      const to = input.status as OrderStatus;
      if (!(to in next) || Object.keys(input).some((key) => key !== "status")) return failure(400, "VALIDATION_ERROR", "status must be one of the known statuses.", [{ field: "status", message: "bad" }]);
      if (!next[order.status].includes(to)) return failure(400, "INVALID_TRANSITION", `An order that is ${order.status} can't become ${to}.`);
      order.status = to;
      order.history.push({ status: to, at: new Date().toISOString() });
      if (to === "cancelled") {
        order.payment.status = "refunded";
        restock(server, order);
      }
      return json({ order: orderView(order, lang) });
    }
    return undefined;
  }

  // ---- the checkout and the orders of the person
  const lines = server.carts.get(cartKey) ?? [];

  if (method === "GET" && path === "/api/checkout") {
    const view = server.cartView(lines, lang);
    const shipping = query.get("shipping") === "express" ? "express" : "standard";
    return json({
      cart: view,
      shippingOptions: [
        { id: "standard", price: shippingCents("standard", view.subtotal), days: [3, 5] },
        { id: "express", price: shippingCents("express", view.subtotal), days: [1, 2] },
      ],
      shipping,
      totals: totalsOf(view.subtotal, shipping),
      ready: view.lines.length > 0 && view.lines.every((line) => line.issue === null),
    });
  }

  if (method === "POST" && path === "/api/orders") {
    const payment = (typeof input.payment === "object" && input.payment !== null ? input.payment : {}) as Record<string, unknown>;
    const address = server.addresses.find((entry) => entry.id === input.addressId);
    if (!address) return failure(404, "NOT_FOUND", "That address wasn't found.", [{ field: "addressId", message: "Choose one of your saved addresses." }]);
    if (lines.length === 0) return failure(400, "CART_EMPTY", "Your cart is empty.");

    const view = server.cartView(lines, lang);
    if (view.lines.some((line) => line.issue !== null)) return failure(409, "CART_CHANGED", "Something in your cart is not available as it was. Please look at your cart again.");

    const method2 = input.shippingMethod === "express" ? "express" : "standard";
    const digits = String(payment.cardNumber ?? "").replace(/\D/g, "");
    const [month, year] = String(payment.expiry ?? "").split("/").map((part) => Number(part.trim()));
    const expYear = year < 100 ? 2000 + year : year;
    const today = new Date();
    if (!passesLuhn(digits)) return failure(400, "VALIDATION_ERROR", "That card number isn't valid.", [{ field: "cardNumber", message: "That card number isn't valid." }]);
    if (!(month >= 1 && month <= 12) || expYear < today.getFullYear() || (expYear === today.getFullYear() && month < today.getMonth() + 1)) return failure(400, "VALIDATION_ERROR", "That card has expired.", [{ field: "expiry", message: "That card has expired." }]);
    if (!/^\d{3,4}$/.test(String(payment.cvc ?? ""))) return failure(400, "VALIDATION_ERROR", "That security code isn't valid.", [{ field: "cvc", message: "bad" }]);
    if (digits === "4000000000000002") return failure(402, "CARD_DECLINED", "Your card was declined.", [{ field: "cardNumber", message: "Your card was declined." }]);
    if (digits === "4000000000009995") return failure(402, "INSUFFICIENT_FUNDS", "There isn't enough money on that card.", [{ field: "cardNumber", message: "no funds" }]);

    // the stock goes out of the shop
    for (const line of lines) {
      for (const id of line.productIds) {
        const record = recordOf(id);
        if (record) server.stock.set(record.product.slug, (server.stock.get(record.product.slug) ?? 0) - line.quantity);
      }
    }

    server.orderCount += 1;
    const id = `64b7f0c2a1b2c3d4e5f6${server.orderCount.toString(16).padStart(4, "0")}`;
    const order: FakeOrder = {
      id,
      number: `SC-${id.slice(-8).toUpperCase()}`,
      userId: who.id,
      email: who.email,
      customerName: who.name,
      status: "paid",
      lines: lines.map((line) => ({ kind: line.kind, productIds: line.productIds, quantity: line.quantity, unitPrice: line.unitPrice, lineTotal: line.unitPrice * line.quantity })),
      address: { fullName: who.name, phone: who.phone ?? null, label: address.label, street: address.street, street2: address.street2 ?? null, city: address.city, state: address.state, postalCode: address.postalCode, country: address.country },
      method: method2,
      totals: totalsOf(view.subtotal, method2),
      payment: { brand: brandOf(digits), last4: digits.slice(-4), reference: `demo_${server.orderCount}`, status: "paid" },
      note: typeof input.note === "string" && input.note.trim() ? input.note.trim() : null,
      history: [{ status: "paid", at: new Date().toISOString() }],
      createdAt: new Date().toISOString(),
    };
    server.orders.push(order);
    server.carts.set(cartKey, []);
    return json({ order: orderView(order, lang) }, 201);
  }

  const mineOrders = [...server.orders].reverse().filter((order) => order.userId === who.id);

  if (method === "GET" && path === "/api/orders") {
    const answer = page(mineOrders, query, 20);
    return json({ ...answer, items: answer.items.map((order) => orderView(order, lang)) });
  }

  const one = /^\/api\/orders\/([0-9a-f]{24})(\/cancel)?$/.exec(path);
  if (one) {
    const order = mineOrders.find((entry) => entry.id === one[1]);
    if (!order) return failure(404, "NOT_FOUND", "That order wasn't found.");
    if (method === "GET" && !one[2]) return json({ order: orderView(order, lang) });
    if (method === "POST" && one[2]) {
      if (order.status !== "paid") return failure(400, "INVALID_TRANSITION", "This order can't be cancelled any more. Please contact us.");
      order.status = "cancelled";
      order.payment.status = "refunded";
      order.history.push({ status: "cancelled", at: new Date().toISOString() });
      restock(server, order);
      return json({ order: orderView(order, lang) });
    }
  }
  return undefined;
}
