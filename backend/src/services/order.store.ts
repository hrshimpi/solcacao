// Where the orders are kept. Like the other stores, the services only talk to this interface, so the tests can use a store
// in memory and the real server uses MongoDB. An order is made once and then only its status moves (see order-status.ts):
// there is no call that changes a price, a line or an address.
import mongoose from "mongoose";
import { requireDatabase } from "../config/db.ts";
import { Order, orderNumberOf, orderStatuses, type OrderDocument, type OrderStatus, type PaymentStatus, type ShippingMethod } from "../models/order.model.ts";
import type { BilingualText } from "../models/product.model.ts";
import { escapeRegex } from "./product.store.ts";
import { objectIdPattern } from "./user.store.ts";

export interface StoredOrderLine {
  kind: "product" | "sampler";
  products: { productId: string; slug: string; name: BilingualText; thumbnail: string; imageAlt: BilingualText }[];
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface StoredOrderAddress {
  fullName: string;
  phone: string | null;
  label: string;
  street: string;
  street2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface StoredOrder {
  id: string;
  number: string;
  userId: string;
  email: string;
  customerName: string;
  status: OrderStatus;
  lines: StoredOrderLine[];
  shippingAddress: StoredOrderAddress;
  shippingMethod: ShippingMethod;
  subtotal: number;
  shippingTotal: number;
  taxTotal: number;
  total: number;
  payment: { method: "card"; brand: string; last4: string; reference: string; status: PaymentStatus };
  note: string | null;
  history: { status: OrderStatus; at: string }[];
  cartKey: string;
  createdAt: string;
  updatedAt: string;
}

// what makes an order: everything but what the store fills in
export type NewOrder = Omit<StoredOrder, "id" | "number" | "createdAt" | "updatedAt">;

export interface OrderQuery {
  status?: OrderStatus;
  // a part of the number, of the email or of the name of the customer
  q?: string;
  page: number;
  limit: number;
}

export interface OrderStats {
  // all orders, and the money of the ones that were not cancelled (whole cents)
  orders: number;
  revenue: number;
  byStatus: Record<OrderStatus, number>;
  // the orders made since the date given to stats()
  today: { orders: number; revenue: number };
}

export interface OrderStore {
  // answers null when an order of the same cart (the same cartKey) exists already
  create(data: NewOrder): Promise<StoredOrder | null>;
  findByCartKey(cartKey: string): Promise<StoredOrder | null>;
  // the order of this user, or null for an order that is somebody else's or does not exist
  findOwned(userId: string, id: string): Promise<StoredOrder | null>;
  // the orders of a user, the newest first
  listForUser(userId: string, page: { page: number; limit: number }): Promise<{ items: StoredOrder[]; total: number }>;
  // for the team: any order
  findById(id: string): Promise<StoredOrder | null>;
  list(query: OrderQuery): Promise<{ items: StoredOrder[]; total: number }>;
  // Moves the order to a new status, but only when it is in one of the statuses in `from` (somebody else may have moved it
  // already). Answers the order, or null when it is not there or was in another status. A refund also marks the payment.
  transition(id: string, from: OrderStatus[], to: OrderStatus, at: Date, options?: { paymentStatus?: PaymentStatus }): Promise<StoredOrder | null>;
  stats(since: Date): Promise<OrderStats>;
}

export const emptyByStatus = (): Record<OrderStatus, number> => Object.fromEntries(orderStatuses.map((status) => [status, 0])) as Record<OrderStatus, number>;

function toStored(doc: OrderDocument): StoredOrder {
  const address = doc.shippingAddress;
  return {
    id: String(doc._id),
    number: doc.number,
    userId: String(doc.userId),
    email: doc.email,
    customerName: doc.customerName,
    status: doc.status,
    lines: doc.lines.map((line) => ({
      kind: line.kind,
      products: line.products.map((product) => ({
        productId: String(product.productId),
        slug: product.slug,
        name: { en: product.name.en, es: product.name.es },
        thumbnail: product.thumbnail,
        imageAlt: { en: product.imageAlt.en, es: product.imageAlt.es },
      })),
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
    })),
    shippingAddress: {
      fullName: address.fullName,
      phone: address.phone ?? null,
      label: address.label,
      street: address.street,
      street2: address.street2 ?? null,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
    },
    shippingMethod: doc.shippingMethod,
    subtotal: doc.subtotal,
    shippingTotal: doc.shippingTotal,
    taxTotal: doc.taxTotal,
    total: doc.total,
    payment: { method: doc.payment.method, brand: doc.payment.brand, last4: doc.payment.last4, reference: doc.payment.reference, status: doc.payment.status },
    note: doc.note ?? null,
    history: doc.history.map((entry) => ({ status: entry.status, at: entry.at.toISOString() })),
    cartKey: doc.cartKey,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function createMongoOrderStore(): OrderStore {
  return {
    async create(data) {
      requireDatabase();
      const doc = new Order({
        ...data,
        userId: new mongoose.Types.ObjectId(data.userId),
        lines: data.lines.map((line) => ({ ...line, products: line.products.map((product) => ({ ...product, productId: new mongoose.Types.ObjectId(product.productId) })) })),
        shippingAddress: { ...data.shippingAddress, phone: data.shippingAddress.phone ?? undefined, street2: data.shippingAddress.street2 ?? undefined },
        note: data.note ?? undefined,
        history: data.history.map((entry) => ({ status: entry.status, at: new Date(entry.at) })),
        // the order is made at the time of its first step
        createdAt: new Date(data.history[0].at),
      });
      doc.number = orderNumberOf(String(doc._id));
      try {
        await doc.save();
      } catch (error) {
        // the same cart was already made into an order a moment ago
        if ((error as { code?: number }).code === 11000 && /cartKey/.test((error as Error).message)) return null;
        throw error;
      }
      return toStored(doc);
    },

    async findByCartKey(cartKey) {
      requireDatabase();
      const doc = await Order.findOne({ cartKey });
      return doc ? toStored(doc) : null;
    },

    async findOwned(userId, id) {
      requireDatabase();
      if (!objectIdPattern.test(userId) || !objectIdPattern.test(id)) return null;
      const doc = await Order.findOne({ _id: id, userId });
      return doc ? toStored(doc) : null;
    },

    async listForUser(userId, { page, limit }) {
      requireDatabase();
      if (!objectIdPattern.test(userId)) return { items: [], total: 0 };
      const [docs, total] = await Promise.all([
        Order.find({ userId }).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
        Order.countDocuments({ userId }),
      ]);
      return { items: docs.map(toStored), total };
    },

    async findById(id) {
      requireDatabase();
      if (!objectIdPattern.test(id)) return null;
      const doc = await Order.findById(id);
      return doc ? toStored(doc) : null;
    },

    async list({ status, q, page, limit }) {
      requireDatabase();
      const filter: Record<string, unknown> = {};
      if (status) filter.status = status;
      const needle = q?.trim();
      if (needle) {
        const pattern = mongoose.trusted({ $regex: escapeRegex(needle), $options: "i" });
        filter.$or = [{ number: pattern }, { email: pattern }, { customerName: pattern }];
      }
      const [docs, total] = await Promise.all([
        Order.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
        Order.countDocuments(filter),
      ]);
      return { items: docs.map(toStored), total };
    },

    async transition(id, from, to, at, options = {}) {
      requireDatabase();
      if (!objectIdPattern.test(id)) return null;
      const doc = await Order.findOneAndUpdate(
        { _id: id, status: mongoose.trusted({ $in: from }) },
        { $set: { status: to, ...(options.paymentStatus ? { "payment.status": options.paymentStatus } : {}) }, $push: { history: { status: to, at } } },
        { returnDocument: "after" },
      );
      return doc ? toStored(doc) : null;
    },

    async stats(since) {
      requireDatabase();
      const [all, recent] = await Promise.all([
        Order.aggregate<{ _id: OrderStatus; count: number; revenue: number }>([{ $group: { _id: "$status", count: { $sum: 1 }, revenue: { $sum: "$total" } } }]),
        Order.aggregate<{ _id: OrderStatus; count: number; revenue: number }>([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: "$status", count: { $sum: 1 }, revenue: { $sum: "$total" } } }]),
      ]);

      const byStatus = emptyByStatus();
      let orders = 0;
      let revenue = 0;
      for (const row of all) {
        byStatus[row._id] = row.count;
        orders += row.count;
        if (row._id !== "cancelled") revenue += row.revenue;
      }
      const today = recent.reduce((sum, row) => ({ orders: sum.orders + row.count, revenue: sum.revenue + (row._id === "cancelled" ? 0 : row.revenue) }), { orders: 0, revenue: 0 });
      return { orders, revenue, byStatus, today };
    },
  };
}
