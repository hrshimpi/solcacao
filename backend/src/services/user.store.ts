// Where user accounts are kept. Like the other stores, the services only talk to this interface, so the tests
// can use a store in memory and the real server uses MongoDB.
// The password hash never travels with a user: it comes out of findCredentials only, for the sign in check.
import mongoose from "mongoose";
import { requireDatabase } from "../config/db.ts";
import { AppError } from "../errors/AppError.ts";
import { User, type UserAccountType, type UserDocument, type UserLanguage, type UserRole } from "../models/user.model.ts";

// a user as the API shows it
export interface StoredUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  accountType: UserAccountType;
  phone?: string;
  preferredLanguage: UserLanguage;
  marketingEmails: boolean;
  createdAt: string;
  updatedAt: string;
}

// what the sign in check and the password change need besides the user
export interface Credentials {
  user: StoredUser;
  passwordHash: string;
  failedLogins: number;
  lockedUntil: Date | null;
}

export interface NewUser {
  email: string;
  name: string;
  passwordHash: string;
  accountType: UserAccountType;
  preferredLanguage: UserLanguage;
  // only the command that creates the first admin sets this, the sign up route never does
  role?: UserRole;
}

// what a person can change on their own account. null takes a value away.
export interface UserPatch {
  name?: string;
  phone?: string | null;
  preferredLanguage?: UserLanguage;
  marketingEmails?: boolean;
}

export interface UserStore {
  // fails with EMAIL_TAKEN (409) when the address already has an account
  create(data: NewUser): Promise<StoredUser>;
  findById(id: string): Promise<StoredUser | null>;
  // the email is compared in lower case
  findCredentials(email: string): Promise<Credentials | null>;
  findCredentialsById(id: string): Promise<Credentials | null>;
  // counts a wrong password, and locks the account for lockMs once maxFailures wrong passwords came in a row
  recordFailedLogin(id: string, options: { maxFailures: number; lockMs: number; now: Date }): Promise<void>;
  // a good sign in: the count starts again
  recordLogin(id: string, now: Date): Promise<void>;
  update(id: string, patch: UserPatch): Promise<StoredUser | null>;
  // takes an account away (a sign up that could not be finished, or an account that is closed)
  remove(id: string): Promise<void>;
  // a new password also ends a lock and any reset link that is still open
  setPassword(id: string, passwordHash: string, now: Date): Promise<void>;
  setResetToken(id: string, tokenHash: string, expiresAt: Date): Promise<void>;
  // finds the user of a reset link that is still good and takes the link away, so it can only be used once
  consumeResetToken(tokenHash: string, now: Date): Promise<StoredUser | null>;
}

// the id MongoDB makes. Anything else cannot be a user, and would only make the database complain.
export const objectIdPattern = /^[0-9a-f]{24}$/i;

const editableFields = ["name", "phone", "preferredLanguage", "marketingEmails"] as const;

function toStored(doc: UserDocument): StoredUser {
  return {
    id: String(doc._id),
    email: doc.email,
    name: doc.name,
    role: doc.role,
    accountType: doc.accountType,
    phone: doc.phone ?? undefined,
    preferredLanguage: doc.preferredLanguage,
    marketingEmails: doc.marketingEmails,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

const secretFields = "+passwordHash +failedLogins +lockedUntil";

function toCredentials(doc: UserDocument): Credentials {
  return {
    user: toStored(doc),
    passwordHash: doc.passwordHash,
    failedLogins: doc.failedLogins ?? 0,
    lockedUntil: doc.lockedUntil ?? null,
  };
}

export const emailTaken = () => new AppError("EMAIL_TAKEN", 409, "An account with that email already exists.");

export function createMongoUserStore(): UserStore {
  return {
    async create(data) {
      requireDatabase();
      try {
        return toStored(await User.create(data));
      } catch (error) {
        if ((error as { code?: number }).code === 11000) throw emailTaken();
        throw error;
      }
    },

    async findById(id) {
      requireDatabase();
      if (!objectIdPattern.test(id)) return null;
      const doc = await User.findById(id);
      return doc ? toStored(doc) : null;
    },

    async findCredentials(email) {
      requireDatabase();
      // an object here (like { "$ne": "" }) would be a query, not an email
      if (typeof email !== "string") return null;
      const doc = await User.findOne({ email: email.toLowerCase() }).select(secretFields);
      return doc ? toCredentials(doc) : null;
    },

    async findCredentialsById(id) {
      requireDatabase();
      if (!objectIdPattern.test(id)) return null;
      const doc = await User.findById(id).select(secretFields);
      return doc ? toCredentials(doc) : null;
    },

    async recordFailedLogin(id, { maxFailures, lockMs, now }) {
      requireDatabase();
      if (!objectIdPattern.test(id)) return;
      const doc = await User.findByIdAndUpdate(id, { $inc: { failedLogins: 1 } }, { new: true }).select("+failedLogins");
      if (doc && doc.failedLogins >= maxFailures) {
        await User.updateOne({ _id: id }, { $set: { lockedUntil: new Date(now.getTime() + lockMs), failedLogins: 0 } });
      }
    },

    async recordLogin(id, now) {
      requireDatabase();
      if (!objectIdPattern.test(id)) return;
      await User.updateOne({ _id: id }, { $set: { failedLogins: 0, lastLoginAt: now }, $unset: { lockedUntil: 1 } });
    },

    async update(id, patch) {
      requireDatabase();
      if (!objectIdPattern.test(id)) return null;

      // only the fields a person may change are read, whatever else the patch carries (role, email, the hash...)
      const set: Record<string, unknown> = {};
      const unset: Record<string, 1> = {};
      for (const field of editableFields) {
        const value = patch[field];
        if (value === null) unset[field] = 1;
        else if (value !== undefined) set[field] = value;
      }

      const doc = await User.findByIdAndUpdate(
        id,
        { ...(Object.keys(set).length > 0 ? { $set: set } : {}), ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}) },
        { new: true, runValidators: true },
      );
      return doc ? toStored(doc) : null;
    },

    async remove(id) {
      requireDatabase();
      if (!objectIdPattern.test(id)) return;
      await User.deleteOne({ _id: id });
    },

    async setPassword(id, passwordHash, now) {
      requireDatabase();
      if (!objectIdPattern.test(id)) return;
      await User.updateOne(
        { _id: id },
        {
          $set: { passwordHash, passwordChangedAt: now, failedLogins: 0 },
          $unset: { lockedUntil: 1, passwordResetTokenHash: 1, passwordResetExpiresAt: 1 },
        },
      );
    },

    async setResetToken(id, tokenHash, expiresAt) {
      requireDatabase();
      if (!objectIdPattern.test(id)) return;
      await User.updateOne({ _id: id }, { $set: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt } });
    },

    async consumeResetToken(tokenHash, now) {
      requireDatabase();
      // the check and the removal are one step, so two requests with the same link cannot both win
      const doc = await User.findOneAndUpdate(
        { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: mongoose.trusted({ $gt: now }) },
        { $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 } },
      );
      return doc ? toStored(doc) : null;
    },
  };
}
