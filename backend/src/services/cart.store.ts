// Where the carts are kept. A cart is read together with its version and saved back only if nobody changed it in
// between, so two tabs that change the same cart at the same moment cannot lose each other's change: the second one
// is told to read again (save answers null).
import mongoose from "mongoose";
import { requireDatabase } from "../config/db.ts";
import { Cart, type CartDocument, type CartLineKind } from "../models/cart.model.ts";
import { objectIdPattern } from "./user.store.ts";

// whose cart it is: a signed in user, or a visitor with the id from the signed cookie
export type CartOwner = { userId: string } | { guestId: string };

export interface StoredCartLine {
  lineId: string;
  kind: CartLineKind;
  productIds: string[];
  quantity: number;
  // whole cents for one unit, locked when the line was made
  unitPrice: number;
}

export interface StoredCart {
  lines: StoredCartLine[];
  version: number;
  updatedAt: string;
}

export interface CartStore {
  // null when the owner has no cart yet
  find(owner: CartOwner): Promise<StoredCart | null>;
  // saves the lines. expectedVersion is the version that was read, or null for an owner that had no cart.
  // Answers the saved cart, or null when somebody else changed (or made) the cart in the meantime.
  // A visitor's cart gets expiresAt, a user's cart never does.
  save(owner: CartOwner, lines: StoredCartLine[], expectedVersion: number | null, expiresAt?: Date): Promise<StoredCart | null>;
  remove(owner: CartOwner): Promise<void>;
}

// an owner that cannot be real has no cart (and cannot make one): a user id is the id MongoDB makes, a visitor's id is a uuid
export function isValidOwner(owner: CartOwner): boolean {
  return "userId" in owner ? typeof owner.userId === "string" && objectIdPattern.test(owner.userId) : typeof owner.guestId === "string" && /^[\w-]{8,64}$/.test(owner.guestId);
}

const keyOf = (owner: CartOwner) => ("userId" in owner ? { userId: owner.userId } : { guestId: owner.guestId });

function toStored(doc: CartDocument): StoredCart {
  return {
    lines: doc.lines.map((line) => ({
      lineId: line.lineId,
      kind: line.kind,
      productIds: line.productIds.map(String),
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    })),
    version: doc.version,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function createMongoCartStore(): CartStore {
  const valid = isValidOwner;

  return {
    async find(owner) {
      requireDatabase();
      if (!valid(owner)) return null;
      const doc = await Cart.findOne(keyOf(owner));
      return doc ? toStored(doc) : null;
    },

    async save(owner, lines, expectedVersion, expiresAt) {
      requireDatabase();
      if (!valid(owner)) return null;

      const data = { lines: lines.map((line) => ({ ...line, productIds: line.productIds.map((id) => new mongoose.Types.ObjectId(id)) })), ...(expiresAt ? { expiresAt } : {}) };

      if (expectedVersion === null) {
        try {
          return toStored(await Cart.create({ ...keyOf(owner), ...data, version: 1 }));
        } catch (error) {
          // somebody made the cart of this owner a moment ago
          if ((error as { code?: number }).code === 11000) return null;
          throw error;
        }
      }

      const doc = await Cart.findOneAndUpdate(
        { ...keyOf(owner), version: expectedVersion },
        { $set: data, $inc: { version: 1 } },
        { new: true, runValidators: true },
      );
      return doc ? toStored(doc) : null;
    },

    async remove(owner) {
      requireDatabase();
      if (!valid(owner)) return;
      await Cart.deleteOne(keyOf(owner));
    },
  };
}
