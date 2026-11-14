// A saved shipping address of a user. There can be many for one user, and at most one of them is the default:
// a partial unique index guarantees that, also when two requests arrive at the same moment.
import { model, Schema, type HydratedDocument, type Types } from "mongoose";
import { jsonPlugin } from "../plugins/json.plugin.ts";

export interface AddressData {
  userId: Types.ObjectId;
  // what the person calls it, like "Home" or "Office"
  label: string;
  street: string;
  // apartment, suite and the like
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type AddressDocument = HydratedDocument<AddressData>;

const addressSchema = new Schema<AddressData>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    label: { type: String, required: true, trim: true, minlength: 1, maxlength: 40 },
    street: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    street2: { type: String, trim: true, maxlength: 120 },
    city: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    state: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    postalCode: { type: String, required: true, trim: true, minlength: 2, maxlength: 20 },
    country: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// the addresses of one user, in the order they were added
addressSchema.index({ userId: 1, createdAt: 1 });

// only one default address for each user
addressSchema.index({ userId: 1 }, { unique: true, partialFilterExpression: { isDefault: true } });

addressSchema.plugin(jsonPlugin);

export const Address = model<AddressData>("Address", addressSchema);
