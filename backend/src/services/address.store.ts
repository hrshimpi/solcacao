// Where the saved addresses of the users are kept. Every call takes the id of the user, and only finds records
// of that user, so one person can never reach the address of another: a record that belongs to somebody else
// is simply not found.
import mongoose from "mongoose";
import { requireDatabase } from "../config/db.ts";
import { Address, type AddressDocument } from "../models/address.model.ts";
import { objectIdPattern } from "./user.store.ts";

export interface StoredAddress {
  id: string;
  userId: string;
  label: string;
  street: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NewAddress {
  label: string;
  street: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

// what changes. null takes the second line away. Which one is the default is only changed with setDefault.
export interface AddressChange {
  label?: string;
  street?: string;
  street2?: string | null;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface AddressStore {
  // the addresses of a user, the oldest first
  list(userId: string): Promise<StoredAddress[]>;
  findOwned(userId: string, id: string): Promise<StoredAddress | null>;
  create(userId: string, data: NewAddress): Promise<StoredAddress>;
  update(userId: string, id: string, change: AddressChange): Promise<StoredAddress | null>;
  // takes an address away and answers it, or null when the user has no such address
  remove(userId: string, id: string): Promise<StoredAddress | null>;
  // makes an address the default and every other address of the user not the default, or null when there is no such address
  setDefault(userId: string, id: string): Promise<StoredAddress | null>;
}

// the fields of a change that can be set, in the order they are written
const changeFields = ["label", "street", "street2", "city", "state", "postalCode", "country"] as const;

function toStored(doc: AddressDocument): StoredAddress {
  return {
    id: String(doc._id),
    userId: String(doc.userId),
    label: doc.label,
    street: doc.street,
    street2: doc.street2 ?? undefined,
    city: doc.city,
    state: doc.state,
    postalCode: doc.postalCode,
    country: doc.country,
    isDefault: doc.isDefault,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function createMongoAddressStore(): AddressStore {
  const valid = (...ids: string[]) => ids.every((id) => objectIdPattern.test(id));

  return {
    async list(userId) {
      requireDatabase();
      if (!valid(userId)) return [];
      const docs = await Address.find({ userId }).sort({ createdAt: 1, _id: 1 });
      return docs.map(toStored);
    },

    async findOwned(userId, id) {
      requireDatabase();
      if (!valid(userId, id)) return null;
      const doc = await Address.findOne({ _id: id, userId });
      return doc ? toStored(doc) : null;
    },

    async create(userId, data) {
      requireDatabase();
      return toStored(await Address.create({ ...data, userId }));
    },

    async update(userId, id, change) {
      requireDatabase();
      if (!valid(userId, id)) return null;

      const set: Record<string, unknown> = {};
      const unset: Record<string, 1> = {};
      for (const field of changeFields) {
        const value = change[field];
        if (value === null) unset[field] = 1;
        else if (value !== undefined) set[field] = value;
      }

      const doc = await Address.findOneAndUpdate(
        { _id: id, userId },
        { ...(Object.keys(set).length > 0 ? { $set: set } : {}), ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}) },
        { new: true, runValidators: true },
      );
      return doc ? toStored(doc) : null;
    },

    async remove(userId, id) {
      requireDatabase();
      if (!valid(userId, id)) return null;
      const doc = await Address.findOneAndDelete({ _id: id, userId });
      return doc ? toStored(doc) : null;
    },

    async setDefault(userId, id) {
      requireDatabase();
      if (!valid(userId, id)) return null;
      // a user that does not own the address must not lose their default because of a wrong id
      if (!(await Address.exists({ _id: id, userId }))) return null;

      // the unique index allows one default for each user: the old one steps down first. If two calls
      // race, the loser gets a duplicate key error from the index and tries once more.
      for (let attempt = 0; ; attempt++) {
        try {
          await Address.updateMany({ userId, isDefault: true, _id: mongoose.trusted({ $ne: new mongoose.Types.ObjectId(id) }) }, { $set: { isDefault: false } });
          const doc = await Address.findOneAndUpdate({ _id: id, userId }, { $set: { isDefault: true } }, { new: true });
          return doc ? toStored(doc) : null;
        } catch (error) {
          if ((error as { code?: number }).code !== 11000 || attempt >= 2) throw error;
        }
      }
    },
  };
}
