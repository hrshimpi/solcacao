// Checkout and orders. Placing an order is one chain, and each step only starts when the one before it worked:
//   1. the cart is read from the server (the page sends no prices, no lines, no totals: only an address, a way to ship
//      and a card), and has to be whole: not empty, and nothing sold out or switched off
//   2. the stock is taken out of the shop, all or nothing, so two shoppers cannot buy the last one
//   3. the card is charged by the payment service (a made up one in the demo, see payment.service.ts), and when it says
//      no the stock goes back
//   4. the order is saved with a copy of everything that mattered on the day, and the cart is emptied
// The same cart can only become one order: pressing the button twice, or two tabs, answer the same order.
// After that the team moves the order along (order-status.ts), and a cancelled order puts the stock back and the money too.
import { AppError } from "../errors/AppError.ts";
import { localize, type Lang } from "../middleware/language.ts";
import type { ShippingMethod } from "../models/order.model.ts";
import type { PlaceOrderInput } from "../schemas/order.schema.ts";
import type { AddressStore } from "./address.store.ts";
import type { CartService } from "./cart.service.ts";
import type { CartStore } from "./cart.store.ts";
import { canChange, customerCanCancel, nextStatuses } from "./order-status.ts";
import type { NewOrder, OrderQuery, OrderStore, StoredOrder } from "./order.store.ts";
import type { PaymentGateway } from "./payment.service.ts";
import { shippingOptions, totalsFor } from "./pricing.ts";
import type { ProductStore, StockItem } from "./product.store.ts";
import type { UserStore } from "./user.store.ts";
import { DEFAULT_LOW_STOCK } from "./stock.ts";

export interface OrderMailer {
  sendOrderConfirmation(order: OrderView, recipient: { email: string; name?: string }, lang: Lang): Promise<unknown>;
  sendOrderShipped(order: OrderView, recipient: { email: string; name?: string }, lang: Lang): Promise<unknown>;
}

export interface OrderServiceDeps {
  orders: OrderStore;
  carts: CartStore;
  cart: CartService;
  products: ProductStore;
  addresses: AddressStore;
  users: UserStore;
  gateway: PaymentGateway;
  // sends the emails, without making a request wait for them
  mail?: OrderMailer;
  now?: () => Date;
}

export interface OrderLineView {
  kind: "product" | "sampler";
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  products: { id: string; slug: string; name: string; thumbnail: string; imageAlt: string }[];
}

export interface OrderView {
  id: string;
  number: string;
  status: StoredOrder["status"];
  // what the team can do next
  nextStatuses: StoredOrder["status"][];
  // the customer can cancel on their own
  canCancel: boolean;
  createdAt: string;
  updatedAt: string;
  lines: OrderLineView[];
  itemCount: number;
  shippingAddress: StoredOrder["shippingAddress"];
  shippingMethod: ShippingMethod;
  totals: { subtotal: number; shipping: number; tax: number; total: number };
  payment: { method: "card"; brand: string; last4: string; reference: string; status: "paid" | "refunded" };
  note: string | null;
  history: StoredOrder["history"];
  customer: { id: string; email: string; name: string };
}

const orderNotFound = () => new AppError("NOT_FOUND", 404, "That order wasn't found.");

export function toOrderView(order: StoredOrder, lang: Lang): OrderView {
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    nextStatuses: nextStatuses(order.status),
    canCancel: customerCanCancel(order.status),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    lines: order.lines.map((line) => ({
      kind: line.kind,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
      products: line.products.map((product) => ({ id: product.productId, slug: product.slug, name: localize(product.name, lang), thumbnail: product.thumbnail, imageAlt: localize(product.imageAlt, lang) })),
    })),
    itemCount: order.lines.reduce((sum, line) => sum + line.quantity, 0),
    shippingAddress: order.shippingAddress,
    shippingMethod: order.shippingMethod,
    totals: { subtotal: order.subtotal, shipping: order.shippingTotal, tax: order.taxTotal, total: order.total },
    payment: { method: order.payment.method, brand: order.payment.brand, last4: order.payment.last4, reference: order.payment.reference, status: order.payment.status },
    note: order.note,
    history: order.history,
    customer: { id: order.userId, email: order.email, name: order.customerName },
  };
}

// the units to take out of the shop for the lines of an order, one entry for each product (a sampler takes one of each of its products for each unit)
function stockOf(lines: StoredOrder["lines"]): StockItem[] {
  const totals = new Map<string, number>();
  for (const line of lines) for (const product of line.products) totals.set(product.productId, (totals.get(product.productId) ?? 0) + line.quantity);
  return [...totals].map(([productId, quantity]) => ({ productId, quantity }));
}

const startOfDay = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

export function createOrderService({ orders, carts, cart, products, addresses, users, gateway, mail, now = () => new Date() }: OrderServiceDeps) {
  // what the checkout page shows before the person pays: the cart, how it can be shipped, and what it all costs
  async function summary(userId: string, shipping: ShippingMethod, lang: Lang) {
    const view = await cart.get({ userId }, lang);
    return {
      cart: view,
      shippingOptions: shippingOptions(view.subtotal),
      shipping,
      totals: totalsFor(view.subtotal, shipping),
      // the cart has to be whole before anybody pays
      ready: view.lines.length > 0 && view.lines.every((line) => line.issue === null),
    };
  }

  async function place(userId: string, input: PlaceOrderInput, lang: Lang): Promise<{ order: OrderView; created: boolean }> {
    const user = await users.findById(userId);
    if (!user) throw new AppError("UNAUTHENTICATED", 401, "Please sign in to do that.");

    const address = await addresses.findOwned(userId, input.addressId);
    if (!address) throw new AppError("NOT_FOUND", 404, "That address wasn't found.", [{ field: "addressId", message: "Choose one of your saved addresses." }]);

    const stored = await carts.find({ userId });
    if (!stored || stored.lines.length === 0) throw new AppError("CART_EMPTY", 400, "Your cart is empty.");

    // the same cart is one order, so a second press of the button gets the order that the first one made. The time is part of
    // the key because a cart that was emptied and made again starts at version 1 once more.
    const cartKey = `${userId}:${stored.version}:${stored.updatedAt}`;
    const already = await orders.findByCartKey(cartKey);
    if (already) return { order: toOrderView(already, lang), created: false };

    const view = await cart.get({ userId }, lang);
    if (view.lines.some((line) => line.issue !== null)) {
      throw new AppError("CART_CHANGED", 409, "Something in your cart is not available as it was. Please look at your cart again.", view.lines.filter((line) => line.issue !== null).map((line) => ({ field: line.lineId, message: line.issue ?? "" })));
    }

    const totals = totalsFor(view.subtotal, input.shippingMethod);
    const known = await products.findByIds(stored.lines.flatMap((line) => line.productIds), { includeInactive: true });
    const byId = new Map(known.map((product) => [product.id, product]));

    const lines: StoredOrder["lines"] = stored.lines.map((line) => ({
      kind: line.kind,
      products: line.productIds.map((id) => {
        const product = byId.get(id);
        if (!product) throw new AppError("CART_CHANGED", 409, "Something in your cart is not available as it was. Please look at your cart again.");
        return { productId: product.id, slug: product.slug, name: product.name, thumbnail: product.thumbnail, imageAlt: product.imageAlt };
      }),
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: line.unitPrice * line.quantity,
    }));

    // 2. the stock
    const items = stockOf(lines);
    const reserved = await products.reserveStock(items);
    if (!reserved.ok) {
      const product = byId.get(reserved.productId);
      const name = product ? localize(product.name, lang) : "That";
      throw new AppError("INSUFFICIENT_STOCK", 409, `${name} is sold out or has fewer left than your cart needs.`, [{ field: "quantity", message: `${name} is sold out or has fewer left than your cart needs.` }]);
    }

    try {
      // 3. the payment
      const charge = await gateway.charge({ amount: totals.total, card: { number: input.payment.cardNumber, expMonth: input.payment.expiry.expMonth, expYear: input.payment.expiry.expYear, cvc: input.payment.cvc, name: input.payment.nameOnCard } });
      if (!charge.ok) {
        await products.releaseStock(items);
        throw paymentProblem(charge.reason);
      }

      // 4. the order
      const at = now();
      const data: NewOrder = {
        userId,
        email: user.email,
        customerName: user.name,
        status: "paid",
        lines,
        shippingAddress: { fullName: user.name, phone: user.phone ?? null, label: address.label, street: address.street, street2: address.street2 ?? null, city: address.city, state: address.state, postalCode: address.postalCode, country: address.country },
        shippingMethod: input.shippingMethod,
        subtotal: totals.subtotal,
        shippingTotal: totals.shipping,
        taxTotal: totals.tax,
        total: totals.total,
        payment: { method: "card", brand: charge.brand, last4: charge.last4, reference: charge.reference, status: "paid" },
        note: input.note?.trim() ? input.note.trim() : null,
        history: [{ status: "paid", at: at.toISOString() }],
        cartKey,
      };

      let saved: StoredOrder | null;
      try {
        saved = await orders.create(data);
      } catch (error) {
        // the money goes back when the order could not be saved (the stock goes back below, for every error that is not ours)
        await gateway.refund(charge.reference).catch(() => {});
        throw error;
      }
      if (!saved) {
        // another request made the order of this cart in the same moment: this one gives its stock and money back
        await gateway.refund(charge.reference);
        await products.releaseStock(items);
        const first = await orders.findByCartKey(cartKey);
        if (!first) throw new AppError("CART_BUSY", 409, "Your order is being made. Please look at your orders in a moment.");
        return { order: toOrderView(first, lang), created: false };
      }

      await carts.remove({ userId });
      const order = toOrderView(saved, lang);
      mail?.sendOrderConfirmation(order, { email: user.email, name: user.name }, user.preferredLanguage).catch(() => {});
      return { order, created: true };
    } catch (error) {
      // an error that is not one of ours (the database went away): the stock was taken and has to go back
      if (!(error instanceof AppError)) await products.releaseStock(items).catch(() => {});
      throw error;
    }
  }

  // puts the stock of the lines back and marks the payment as given back
  async function cancel(order: StoredOrder, from: StoredOrder["status"][], lang: Lang): Promise<OrderView> {
    const changed = await orders.transition(order.id, from, "cancelled", now(), { paymentStatus: "refunded" });
    if (!changed) throw new AppError("ORDER_CHANGED", 409, "The order was changed in the meantime. Please look at it again.");
    await products.releaseStock(stockOf(changed.lines));
    await gateway.refund(changed.payment.reference);
    return toOrderView(changed, lang);
  }

  return {
    summary,
    place,

    async list(userId: string, page: { page: number; limit: number }, lang: Lang) {
      const { items, total } = await orders.listForUser(userId, page);
      return { items: items.map((order) => toOrderView(order, lang)), page: page.page, limit: page.limit, total };
    },

    async get(userId: string, id: string, lang: Lang): Promise<OrderView> {
      const order = await orders.findOwned(userId, id);
      if (!order) throw orderNotFound();
      return toOrderView(order, lang);
    },

    // the customer cancels an order that nobody started to pack
    async cancelOwn(userId: string, id: string, lang: Lang): Promise<OrderView> {
      const order = await orders.findOwned(userId, id);
      if (!order) throw orderNotFound();
      if (!customerCanCancel(order.status)) throw new AppError("INVALID_TRANSITION", 400, "This order can't be cancelled any more. Please contact us.");
      return cancel(order, ["paid"], lang);
    },

    // ---- for the team

    async adminList(query: OrderQuery, lang: Lang) {
      const { items, total } = await orders.list(query);
      return { items: items.map((order) => toOrderView(order, lang)), page: query.page, limit: query.limit, total };
    },

    async adminGet(id: string, lang: Lang): Promise<OrderView> {
      const order = await orders.findById(id);
      if (!order) throw orderNotFound();
      return toOrderView(order, lang);
    },

    async adminSetStatus(id: string, to: StoredOrder["status"], lang: Lang): Promise<OrderView> {
      const order = await orders.findById(id);
      if (!order) throw orderNotFound();
      if (!canChange(order.status, to)) throw new AppError("INVALID_TRANSITION", 400, `An order that is ${order.status} can't become ${to}.`);

      if (to === "cancelled") return cancel(order, [order.status], lang);

      const changed = await orders.transition(order.id, [order.status], to, now());
      if (!changed) throw new AppError("ORDER_CHANGED", 409, "The order was changed in the meantime. Please look at it again.");
      const view = toOrderView(changed, lang);
      if (to === "shipped") {
        const customer = await users.findById(changed.userId);
        mail?.sendOrderShipped(view, { email: changed.email, name: changed.customerName }, customer?.preferredLanguage ?? "en").catch(() => {});
      }
      return view;
    },

    // the numbers of the dashboard of the team
    async stats(lang: Lang) {
      const [totals, customers, shop, recent] = await Promise.all([
        orders.stats(startOfDay(now())),
        users.count(),
        products.list({ sort: "featured", page: 1, limit: 48, includeInactive: true }),
        orders.list({ page: 1, limit: 6 }),
      ]);
      const lowStock = shop.items
        .filter((product) => product.active && product.quantity <= (product.lowStockThreshold ?? DEFAULT_LOW_STOCK))
        .sort((a, b) => a.quantity - b.quantity)
        .slice(0, 8)
        .map((product) => ({ id: product.id, slug: product.slug, name: localize(product.name, lang), quantity: product.quantity, lowStockThreshold: product.lowStockThreshold }));
      return {
        orders: totals.orders,
        revenue: totals.revenue,
        averageOrder: totals.orders - totals.byStatus.cancelled > 0 ? Math.round(totals.revenue / (totals.orders - totals.byStatus.cancelled)) : 0,
        byStatus: totals.byStatus,
        today: totals.today,
        customers,
        products: shop.total,
        lowStock,
        recentOrders: recent.items.map((order) => toOrderView(order, lang)),
      };
    },
  };
}

function paymentProblem(reason: "invalid_card" | "expired_card" | "invalid_cvc" | "card_declined" | "insufficient_funds"): AppError {
  switch (reason) {
    case "invalid_card":
      return new AppError("VALIDATION_ERROR", 400, "That card number isn't valid.", [{ field: "cardNumber", message: "That card number isn't valid." }]);
    case "expired_card":
      return new AppError("VALIDATION_ERROR", 400, "That card has expired.", [{ field: "expiry", message: "That card has expired." }]);
    case "invalid_cvc":
      return new AppError("VALIDATION_ERROR", 400, "That security code isn't valid.", [{ field: "cvc", message: "That security code isn't valid." }]);
    case "insufficient_funds":
      return new AppError("INSUFFICIENT_FUNDS", 402, "There isn't enough money on that card.", [{ field: "cardNumber", message: "There isn't enough money on that card." }]);
    case "card_declined":
      return new AppError("CARD_DECLINED", 402, "Your card was declined.", [{ field: "cardNumber", message: "Your card was declined." }]);
  }
}

export type OrderService = ReturnType<typeof createOrderService>;
