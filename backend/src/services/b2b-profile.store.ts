// Where the business details of business accounts are kept. The verification status can only be changed through
// setVerification (our team), never through save (the person).
import { requireDatabase } from "../config/db.ts";
import { B2BProfile, type B2BProfileDocument, type VerificationStatus } from "../models/b2b-profile.model.ts";
import { objectIdPattern } from "./user.store.ts";

export interface StoredB2BProfile {
  userId: string;
  companyName: string;
  taxId?: string;
  industry?: string;
  verificationStatus: VerificationStatus;
  createdAt: string;
  updatedAt: string;
}

// what the person fills in. null takes a value away, a field that is left out stays as it was.
export interface B2BProfileInput {
  companyName: string;
  taxId?: string | null;
  industry?: string | null;
}

export interface B2BProfileStore {
  findByUserId(userId: string): Promise<StoredB2BProfile | null>;
  // creates the details, or changes them when they exist. A new profile starts as pending, an existing one keeps its status.
  save(userId: string, input: B2BProfileInput): Promise<StoredB2BProfile>;
  // for our team: null when the user has no business details
  setVerification(userId: string, status: VerificationStatus): Promise<StoredB2BProfile | null>;
  remove(userId: string): Promise<void>;
}

function toStored(doc: B2BProfileDocument): StoredB2BProfile {
  return {
    userId: String(doc.userId),
    companyName: doc.companyName,
    taxId: doc.taxId ?? undefined,
    industry: doc.industry ?? undefined,
    verificationStatus: doc.verificationStatus,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

// splits the input into what is set and what is taken away
export function setAndUnset(input: B2BProfileInput) {
  const set: Record<string, string> = { companyName: input.companyName };
  const unset: Record<string, 1> = {};
  for (const field of ["taxId", "industry"] as const) {
    const value = input[field];
    if (value === null) unset[field] = 1;
    else if (value !== undefined) set[field] = value;
  }
  return { set, unset };
}

export function createMongoB2BProfileStore(): B2BProfileStore {
  return {
    async findByUserId(userId) {
      requireDatabase();
      if (!objectIdPattern.test(userId)) return null;
      const doc = await B2BProfile.findOne({ userId });
      return doc ? toStored(doc) : null;
    },

    async save(userId, input) {
      requireDatabase();
      const { set, unset } = setAndUnset(input);
      const doc = await B2BProfile.findOneAndUpdate(
        { userId },
        { $set: set, ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}), $setOnInsert: { userId } },
        { new: true, upsert: true, runValidators: true },
      );
      return toStored(doc);
    },

    async setVerification(userId, status) {
      requireDatabase();
      if (!objectIdPattern.test(userId)) return null;
      const doc = await B2BProfile.findOneAndUpdate({ userId }, { $set: { verificationStatus: status } }, { new: true });
      return doc ? toStored(doc) : null;
    },

    async remove(userId) {
      requireDatabase();
      if (!objectIdPattern.test(userId)) return;
      await B2BProfile.deleteOne({ userId });
    },
  };
}
