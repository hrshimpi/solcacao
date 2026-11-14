// A user store that keeps everything in memory, for the tests. It answers in the same shape as the MongoDB
// store (the shared tests in user.store.test.ts run against both).
import mongoose from "mongoose";
import { emailTaken, type Credentials, type NewUser, type StoredUser, type UserStore } from "../services/user.store.ts";

interface UserRecord extends StoredUser {
  passwordHash: string;
  failedLogins: number;
  lockedUntil: Date | null;
  resetTokenHash: string | null;
  resetExpiresAt: Date | null;
}

export function createMemoryUserStore() {
  const records: UserRecord[] = [];
  const start = Date.parse("2026-01-01T00:00:00.000Z");
  let ticks = 0;
  const stamp = () => new Date(start + ticks++ * 1000).toISOString();

  const byId = (id: string) => records.find((record) => record.id === id.toLowerCase());
  const publicPart = (record: UserRecord): StoredUser => ({
    id: record.id,
    email: record.email,
    name: record.name,
    role: record.role,
    accountType: record.accountType,
    phone: record.phone,
    preferredLanguage: record.preferredLanguage,
    marketingEmails: record.marketingEmails,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
  const credentialsOf = (record: UserRecord): Credentials => ({
    user: publicPart(record),
    passwordHash: record.passwordHash,
    failedLogins: record.failedLogins,
    lockedUntil: record.lockedUntil,
  });

  const store: UserStore & { all(): StoredUser[] } = {
    async create(data: NewUser) {
      const email = data.email.toLowerCase();
      if (records.some((record) => record.email === email)) throw emailTaken();

      const created = stamp();
      const record: UserRecord = {
        id: new mongoose.Types.ObjectId().toString(),
        email,
        name: data.name,
        role: data.role ?? "user",
        accountType: data.accountType,
        preferredLanguage: data.preferredLanguage,
        marketingEmails: false,
        createdAt: created,
        updatedAt: created,
        passwordHash: data.passwordHash,
        failedLogins: 0,
        lockedUntil: null,
        resetTokenHash: null,
        resetExpiresAt: null,
      };
      records.push(record);
      return publicPart(record);
    },

    async findById(id) {
      const found = byId(id);
      return found ? publicPart(found) : null;
    },

    async findCredentials(email) {
      if (typeof email !== "string") return null;
      const found = records.find((record) => record.email === email.toLowerCase());
      return found ? credentialsOf(found) : null;
    },

    async findCredentialsById(id) {
      const found = byId(id);
      return found ? credentialsOf(found) : null;
    },

    async recordFailedLogin(id, { maxFailures, lockMs, now }) {
      const found = byId(id);
      if (!found) return;
      found.failedLogins += 1;
      if (found.failedLogins >= maxFailures) {
        found.lockedUntil = new Date(now.getTime() + lockMs);
        found.failedLogins = 0;
      }
    },

    async recordLogin(id) {
      const found = byId(id);
      if (!found) return;
      found.failedLogins = 0;
      found.lockedUntil = null;
    },

    async update(id, patch) {
      const found = byId(id);
      if (!found) return null;
      if (patch.name !== undefined) found.name = patch.name;
      if (patch.phone === null) delete found.phone;
      else if (patch.phone !== undefined) found.phone = patch.phone;
      if (patch.preferredLanguage !== undefined) found.preferredLanguage = patch.preferredLanguage;
      if (patch.marketingEmails !== undefined) found.marketingEmails = patch.marketingEmails;
      found.updatedAt = stamp();
      return publicPart(found);
    },

    async remove(id) {
      const index = records.findIndex((record) => record.id === id.toLowerCase());
      if (index >= 0) records.splice(index, 1);
    },

    async setPassword(id, passwordHash) {
      const found = byId(id);
      if (!found) return;
      found.passwordHash = passwordHash;
      found.failedLogins = 0;
      found.lockedUntil = null;
      found.resetTokenHash = null;
      found.resetExpiresAt = null;
    },

    async setResetToken(id, tokenHash, expiresAt) {
      const found = byId(id);
      if (!found) return;
      found.resetTokenHash = tokenHash;
      found.resetExpiresAt = expiresAt;
    },

    async consumeResetToken(tokenHash, now) {
      const found = records.find((record) => record.resetTokenHash === tokenHash && record.resetExpiresAt !== null && record.resetExpiresAt > now);
      if (!found) return null;
      found.resetTokenHash = null;
      found.resetExpiresAt = null;
      return publicPart(found);
    },

    all() {
      return records.map(publicPart);
    },
  };

  return store;
}
