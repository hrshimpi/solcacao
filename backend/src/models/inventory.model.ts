// The Inventory model: how many of a product we have. One document for each product, so changing the stock never
// touches the product itself and two people changing different products never meet.
import { model, Schema, type HydratedDocument, type Types } from "mongoose";

export interface InventoryData {
  productId: Types.ObjectId;
  // units we can sell, never below zero
  quantity: number;
  // at or under this many units the shop says "low stock"
  lowStockThreshold: number;
  updatedAt: Date;
}

export type InventoryDocument = HydratedDocument<InventoryData>;

const wholeNumber = { validator: Number.isInteger, message: "{PATH} must be a whole number" };

const inventorySchema = new Schema<InventoryData>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 0, max: 1_000_000, validate: wholeNumber, default: 0 },
    lowStockThreshold: { type: Number, min: 0, max: 1_000_000, validate: wholeNumber, default: 10 },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

inventorySchema.index({ productId: 1 }, { unique: true });

export const Inventory = model<InventoryData>("Inventory", inventorySchema);
