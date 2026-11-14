// The Cart model: the things a shopper put aside. A signed in user has one cart (userId), a visitor has one that
// belongs to a random id in a signed cookie (guestId). Each line holds one product, or a sampler of several, with the
// price it had when it was added: a later change of the price of the product does not change it.
// A visitor's cart is removed by MongoDB itself 30 days after it was last changed.
import { model, Schema, type HydratedDocument, type Types } from "mongoose";

export const cartLineKinds = ["product", "sampler"] as const;
export type CartLineKind = (typeof cartLineKinds)[number];

export const MAX_LINE_QUANTITY = 99;
export const MAX_CART_LINES = 30;

export interface CartLineData {
  // the same for the same things, so adding a product twice is one line: "p-<product id>" or "s-<hash of the products>"
  lineId: string;
  kind: CartLineKind;
  productIds: Types.ObjectId[];
  quantity: number;
  // whole cents for one unit, locked when the line was made
  unitPrice: number;
}

export interface CartData {
  userId?: Types.ObjectId;
  guestId?: string;
  lines: CartLineData[];
  // counts the changes, so that two changes made at the same moment cannot overwrite each other
  version: number;
  // only for the cart of a visitor: when it can be removed
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type CartDocument = HydratedDocument<CartData>;

const lineSchema = new Schema<CartLineData>(
  {
    lineId: { type: String, required: true, match: /^(p-[0-9a-f]{24}|s-[0-9a-f]{20})$/ },
    kind: { type: String, enum: cartLineKinds, required: true },
    productIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Product" }],
      validate: { validator: (ids: unknown[]) => ids.length >= 1 && ids.length <= 6, message: "{PATH} needs between 1 and 6 products" },
    },
    quantity: { type: Number, required: true, min: 1, max: MAX_LINE_QUANTITY, validate: { validator: Number.isInteger, message: "{PATH} must be a whole number" } },
    unitPrice: { type: Number, required: true, min: 0, validate: { validator: Number.isInteger, message: "{PATH} must be a whole number of cents" } },
  },
  { _id: false },
);

const cartSchema = new Schema<CartData>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    guestId: { type: String, maxlength: 64 },
    lines: {
      type: [lineSchema],
      validate: { validator: (lines: unknown[]) => lines.length <= MAX_CART_LINES, message: `{PATH} can have at most ${MAX_CART_LINES} lines` },
    },
    version: { type: Number, default: 0 },
    expiresAt: { type: Date },
  },
  { timestamps: true },
);

// one cart for each user and one for each visitor, even when two requests arrive at the same moment
cartSchema.index({ userId: 1 }, { unique: true, partialFilterExpression: { userId: { $exists: true } } });
cartSchema.index({ guestId: 1 }, { unique: true, partialFilterExpression: { guestId: { $exists: true } } });

// MongoDB removes a cart of a visitor by itself when it has expired. A cart of a user has no date, so it stays.
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Cart = model<CartData>("Cart", cartSchema);
