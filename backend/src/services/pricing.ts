// What an order costs, in whole cents. The rules live here and only here: the checkout page shows what the server says,
// and the server charges what it worked out, so a page can never pay a price that it made up.
//   shipping  standard $5.95 and free from $60.00 of products, express $14.95
//   tax       8.25% of the products (a flat rate, to keep the demo simple)
import type { ShippingMethod } from "../models/order.model.ts";

export const TAX_RATE = 0.0825;

interface ShippingRule {
  price: number;
  // delivery time in business days, from and to
  days: [number, number];
  // the products cost at least this much (cents): shipping is free
  freeFrom?: number;
}

export const shippingRules: Record<ShippingMethod, ShippingRule> = {
  standard: { price: 595, days: [3, 5], freeFrom: 6000 },
  express: { price: 1495, days: [1, 2] },
};

export function shippingPrice(method: ShippingMethod, subtotal: number): number {
  const rule = shippingRules[method];
  return rule.freeFrom !== undefined && subtotal >= rule.freeFrom ? 0 : rule.price;
}

export function taxOf(subtotal: number): number {
  return Math.round(subtotal * TAX_RATE);
}

export interface Totals {
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
}

export function totalsFor(subtotal: number, method: ShippingMethod): Totals {
  const shipping = shippingPrice(method, subtotal);
  const tax = taxOf(subtotal);
  return { subtotal, shipping, tax, total: subtotal + shipping + tax };
}

// the ways to ship, with what each costs for this much in the cart
export function shippingOptions(subtotal: number): { id: ShippingMethod; price: number; days: [number, number] }[] {
  return (Object.keys(shippingRules) as ShippingMethod[]).map((id) => ({ id, price: shippingPrice(id, subtotal), days: shippingRules[id].days }));
}
