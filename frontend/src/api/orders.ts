// Calls for checkout and orders. The page sends an address, a way to ship and a card, and the server answers with the order.
// What things cost comes from the server (whole cents on the wire, dollars in the page), so the page never works out a price.
import type { Lang } from "../i18n";
import { api } from "../lib/api";
import { ApiError } from "../lib/apiFetch";
import { readCart, type Cart } from "./cart";

export const orderStatuses = ["paid", "processing", "shipped", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof orderStatuses)[number];

export type ShippingMethod = "standard" | "express";
export const shippingMethods: ShippingMethod[] = ["standard", "express"];

export interface OrderProduct {
  id: string;
  slug: string;
  name: string;
  thumbnail: string;
  imageAlt: string;
}

export interface OrderLine {
  kind: "product" | "sampler";
  quantity: number;
  // in dollars
  unitPrice: number;
  lineTotal: number;
  products: OrderProduct[];
}

export interface OrderAddress {
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

export interface Totals {
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
}

export interface Order {
  id: string;
  number: string;
  status: OrderStatus;
  // the steps the team can take next (the dashboard shows them as buttons)
  nextStatuses: OrderStatus[];
  // the customer can cancel on their own
  canCancel: boolean;
  createdAt: string;
  lines: OrderLine[];
  itemCount: number;
  shippingAddress: OrderAddress;
  shippingMethod: ShippingMethod;
  totals: Totals;
  payment: { brand: string; last4: string; status: "paid" | "refunded" };
  note: string | null;
  history: { status: OrderStatus; at: string }[];
  customer: { id: string; email: string; name: string };
}

export interface OrderPage {
  items: Order[];
  page: number;
  limit: number;
  total: number;
}

export interface ShippingOption {
  id: ShippingMethod;
  // in dollars
  price: number;
  // delivery time in business days, from and to
  days: [number, number];
}

export interface Checkout {
  cart: Cart;
  shippingOptions: ShippingOption[];
  // the cart is whole: something in it, and nothing sold out or switched off
  ready: boolean;
  // what the tax of this cart is, in dollars (it does not depend on how it is shipped)
  tax: number;
}

type Options = { lang: Lang; signal?: AbortSignal };

const text = (value: unknown) => (typeof value === "string" ? value : "");
const cents = (value: unknown) => (typeof value === "number" && Number.isInteger(value) && value >= 0 ? value / 100 : null);
const record = (value: unknown): Record<string, unknown> | null => (typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null);

function readProduct(raw: unknown): OrderProduct | null {
  const item = record(raw);
  if (!item || !text(item.id) || !text(item.slug)) return null;
  return { id: text(item.id), slug: text(item.slug), name: text(item.name), thumbnail: text(item.thumbnail), imageAlt: text(item.imageAlt) };
}

function readLine(raw: unknown): OrderLine | null {
  const item = record(raw);
  if (!item || (item.kind !== "product" && item.kind !== "sampler")) return null;
  const unitPrice = cents(item.unitPrice);
  const lineTotal = cents(item.lineTotal);
  const quantity = item.quantity;
  if (unitPrice === null || lineTotal === null || typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) return null;
  const products = (Array.isArray(item.products) ? item.products : []).map(readProduct).filter((product): product is OrderProduct => product !== null);
  return products.length > 0 ? { kind: item.kind, quantity, unitPrice, lineTotal, products } : null;
}

const isStatus = (value: unknown): value is OrderStatus => orderStatuses.includes(value as OrderStatus);

// one order of an answer, or null when it is not in the shape we know
export function readOrder(raw: unknown): Order | null {
  const item = record(raw);
  if (!item || !text(item.id) || !/^SC-[0-9A-F]{8}$/.test(text(item.number)) || !isStatus(item.status)) return null;

  const totals = record(item.totals);
  const [subtotal, shipping, tax, total] = [totals?.subtotal, totals?.shipping, totals?.tax, totals?.total].map(cents);
  if (subtotal === null || shipping === null || tax === null || total === null) return null;

  const address = record(item.shippingAddress);
  const payment = record(item.payment);
  const customer = record(item.customer);
  if (!address || !payment || !text(address.street) || !text(payment.last4)) return null;
  if (item.shippingMethod !== "standard" && item.shippingMethod !== "express") return null;

  const lines = (Array.isArray(item.lines) ? item.lines : []).map(readLine).filter((line): line is OrderLine => line !== null);
  if (lines.length === 0) return null;

  const history = (Array.isArray(item.history) ? item.history : []).flatMap((entry): Order["history"] => {
    const step = record(entry);
    return step && isStatus(step.status) && text(step.at) ? [{ status: step.status, at: text(step.at) }] : [];
  });

  return {
    id: text(item.id),
    number: text(item.number),
    status: item.status,
    nextStatuses: (Array.isArray(item.nextStatuses) ? item.nextStatuses : []).filter(isStatus),
    canCancel: item.canCancel === true,
    createdAt: text(item.createdAt),
    lines,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    shippingAddress: {
      fullName: text(address.fullName),
      phone: text(address.phone) || null,
      label: text(address.label),
      street: text(address.street),
      street2: text(address.street2) || null,
      city: text(address.city),
      state: text(address.state),
      postalCode: text(address.postalCode),
      country: text(address.country),
    },
    shippingMethod: item.shippingMethod,
    totals: { subtotal, shipping, tax, total },
    payment: { brand: text(payment.brand) || "card", last4: text(payment.last4), status: payment.status === "refunded" ? "refunded" : "paid" },
    note: text(item.note) || null,
    history,
    customer: { id: text(customer?.id), email: text(customer?.email), name: text(customer?.name) },
  };
}

export function readOrderAnswer(body: unknown): Order {
  const order = readOrder(record(body)?.order);
  if (!order) throw new ApiError("The answer was not an order.");
  return order;
}

export function readOrderPage(body: unknown): OrderPage {
  const page = record(body);
  if (!page || !Array.isArray(page.items) || typeof page.total !== "number") throw new ApiError("The answer was not a list of orders.");
  return {
    items: page.items.map(readOrder).filter((order): order is Order => order !== null),
    page: typeof page.page === "number" ? page.page : 1,
    limit: typeof page.limit === "number" ? page.limit : page.items.length,
    total: page.total,
  };
}

function readCheckout(body: unknown): Checkout {
  const answer = record(body);
  const options = (Array.isArray(answer?.shippingOptions) ? answer.shippingOptions : []).flatMap((entry): ShippingOption[] => {
    const option = record(entry);
    const price = cents(option?.price);
    const days = option?.days;
    if (!option || (option.id !== "standard" && option.id !== "express") || price === null || !Array.isArray(days) || days.length !== 2) return [];
    return [{ id: option.id, price, days: [Number(days[0]), Number(days[1])] }];
  });
  const tax = cents(record(answer?.totals)?.tax);
  if (!answer || options.length === 0 || tax === null) throw new ApiError("The answer was not a checkout.");
  return { cart: readCart(body), shippingOptions: options, ready: answer.ready === true, tax };
}

export async function fetchCheckout({ lang, signal }: Options): Promise<Checkout> {
  return readCheckout(await api.get<unknown>("/checkout", { lang, signal }));
}

export interface PlaceOrderInput {
  addressId: string;
  shippingMethod: ShippingMethod;
  cardNumber: string;
  expiry: string;
  cvc: string;
  nameOnCard: string;
  note?: string;
}

export async function placeOrder(input: PlaceOrderInput, { lang }: Options): Promise<Order> {
  const { cardNumber, expiry, cvc, nameOnCard, note, ...rest } = input;
  const json = { ...rest, payment: { cardNumber, expiry, cvc, nameOnCard }, ...(note ? { note } : {}) };
  return readOrderAnswer(await api.post<unknown>("/orders", { lang, json }));
}

export async function fetchOrders({ page, limit = 10, lang, signal }: Options & { page: number; limit?: number }): Promise<OrderPage> {
  return readOrderPage(await api.get<unknown>("/orders", { lang, signal, query: { page, limit } }));
}

export async function fetchOrder(id: string, { lang, signal }: Options): Promise<Order> {
  return readOrderAnswer(await api.get<unknown>(`/orders/${id}`, { lang, signal }));
}

export async function cancelOrder(id: string, { lang }: Options): Promise<Order> {
  return readOrderAnswer(await api.post<unknown>(`/orders/${id}/cancel`, { lang }));
}
