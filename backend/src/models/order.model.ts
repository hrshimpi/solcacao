// The Order model: what somebody bought. An order keeps a copy of everything that mattered on the day it was made (the
// names and prices of the lines, the address, what the shipping cost, the last four digits of the card), so nothing that
// changes later in the shop, in the address book or in a price changes an order that was already paid.
// The number of an order is "SC-" and the last 8 characters of its id, in capitals, like the quote requests.
import { model, Schema, type HydratedDocument, type Types } from "mongoose";
import type { BilingualText } from "./product.model.ts";

export const orderStatuses = ["paid", "processing", "shipped", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof orderStatuses)[number];

export const shippingMethods = ["standard", "express"] as const;
export type ShippingMethod = (typeof shippingMethods)[number];

export const paymentStatuses = ["paid", "refunded"] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

export interface OrderLineProductData {
  productId: Types.ObjectId;
  slug: string;
  name: BilingualText;
  thumbnail: string;
  imageAlt: BilingualText;
}

export interface OrderLineData {
  kind: "product" | "sampler";
  products: OrderLineProductData[];
  quantity: number;
  // whole cents
  unitPrice: number;
  lineTotal: number;
}

export interface OrderAddressData {
  fullName: string;
  phone?: string;
  label: string;
  street: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface OrderPaymentData {
  method: "card";
  // visa, mastercard, amex, discover or card: the only things kept of the card are the brand and the last four digits
  brand: string;
  last4: string;
  // what the payment service answered, to find the payment there
  reference: string;
  status: PaymentStatus;
}

export interface OrderHistoryData {
  status: OrderStatus;
  at: Date;
}

export interface OrderData {
  number: string;
  userId: Types.ObjectId;
  email: string;
  customerName: string;
  status: OrderStatus;
  lines: OrderLineData[];
  shippingAddress: OrderAddressData;
  shippingMethod: ShippingMethod;
  // whole cents
  subtotal: number;
  shippingTotal: number;
  taxTotal: number;
  total: number;
  payment: OrderPaymentData;
  note?: string;
  history: OrderHistoryData[];
  // "<user id>:<version of the cart>": the same cart can only become one order, even when the button is pressed twice
  cartKey: string;
  createdAt: Date;
  updatedAt: Date;
}

export type OrderDocument = HydratedDocument<OrderData>;

const cents = { type: Number, required: true, min: 0, max: 100_000_000, validate: { validator: Number.isInteger, message: "{PATH} must be a whole number of cents" } };
const bilingual = { type: new Schema({ en: { type: String, required: true }, es: { type: String, required: true } }, { _id: false }), required: true };

const lineSchema = new Schema<OrderLineData>(
  {
    kind: { type: String, enum: ["product", "sampler"], required: true },
    products: {
      type: [
        new Schema<OrderLineProductData>(
          {
            productId: { type: Schema.Types.ObjectId, required: true },
            slug: { type: String, required: true },
            name: bilingual,
            thumbnail: { type: String, required: true },
            imageAlt: bilingual,
          },
          { _id: false },
        ),
      ],
      validate: (value: unknown[]) => value.length > 0,
    },
    quantity: { type: Number, required: true, min: 1, max: 99, validate: Number.isInteger },
    unitPrice: cents,
    lineTotal: cents,
  },
  { _id: false },
);

const addressSchema = new Schema<OrderAddressData>(
  {
    fullName: { type: String, required: true, maxlength: 120 },
    phone: { type: String, maxlength: 30 },
    label: { type: String, required: true, maxlength: 60 },
    street: { type: String, required: true, maxlength: 120 },
    street2: { type: String, maxlength: 120 },
    city: { type: String, required: true, maxlength: 80 },
    state: { type: String, required: true, maxlength: 80 },
    postalCode: { type: String, required: true, maxlength: 20 },
    country: { type: String, required: true, maxlength: 80 },
  },
  { _id: false },
);

const orderSchema = new Schema<OrderData>(
  {
    number: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    email: { type: String, required: true, lowercase: true, maxlength: 254 },
    customerName: { type: String, required: true, maxlength: 120 },
    status: { type: String, enum: orderStatuses, required: true, default: "paid" },
    lines: { type: [lineSchema], validate: (value: unknown[]) => value.length > 0 && value.length <= 30 },
    shippingAddress: { type: addressSchema, required: true },
    shippingMethod: { type: String, enum: shippingMethods, required: true },
    subtotal: cents,
    shippingTotal: cents,
    taxTotal: cents,
    total: cents,
    payment: {
      type: new Schema<OrderPaymentData>(
        {
          method: { type: String, enum: ["card"], required: true },
          brand: { type: String, required: true, maxlength: 20 },
          last4: { type: String, required: true, match: /^\d{4}$/ },
          reference: { type: String, required: true, maxlength: 60 },
          status: { type: String, enum: paymentStatuses, required: true },
        },
        { _id: false },
      ),
      required: true,
    },
    note: { type: String, maxlength: 300 },
    history: {
      type: [new Schema<OrderHistoryData>({ status: { type: String, enum: orderStatuses, required: true }, at: { type: Date, required: true } }, { _id: false })],
      validate: (value: unknown[]) => value.length > 0,
    },
    cartKey: { type: String, required: true },
  },
  { timestamps: true },
);

// the orders of a person, newest first
orderSchema.index({ userId: 1, createdAt: -1 });
// the list of the admin, by status and in all
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ number: 1 }, { unique: true });
// one cart, one order
orderSchema.index({ cartKey: 1 }, { unique: true });

export const Order = model<OrderData>("Order", orderSchema);

// "SC-" and the last 8 characters of the id of the order
export function orderNumberOf(id: string): string {
  return `SC-${id.slice(-8).toUpperCase()}`;
}
