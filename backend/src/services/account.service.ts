// What a signed in person can do with their own account: read and change the profile, change the password, keep
// a list of shipping addresses and, for a business account, the business details. Every call starts from the id of
// the user in the token, and the stores only ever look at records of that user.
import { AppError } from "../errors/AppError.ts";
import type { VerificationStatus } from "../models/b2b-profile.model.ts";
import type { AddressCreateInput, AddressPatch, B2BProfileBody, ProfilePatch } from "../schemas/account.schema.ts";
import type { AddressStore, StoredAddress } from "./address.store.ts";
import type { AuthService, AuthSession } from "./auth.service.ts";
import type { B2BProfileStore, StoredB2BProfile } from "./b2b-profile.store.ts";
import type { StoredUser, UserStore } from "./user.store.ts";

export const MAX_ADDRESSES = 10;

export interface AccountServiceDeps {
  users: UserStore;
  profiles: B2BProfileStore;
  addresses: AddressStore;
  auth: Pick<AuthService, "changePassword">;
}

const signedOut = () => new AppError("UNAUTHENTICATED", 401, "Please sign in again to do that.");
const noSuchAddress = () => new AppError("NOT_FOUND", 404, "That address wasn't found.");

export function createAccountService({ users, profiles, addresses, auth }: AccountServiceDeps) {
  // the user of the token, or the answer for a token whose account is gone
  async function currentUser(userId: string): Promise<StoredUser> {
    const user = await users.findById(userId);
    if (!user) throw signedOut();
    return user;
  }

  async function businessUser(userId: string): Promise<StoredUser> {
    const user = await currentUser(userId);
    if (user.accountType !== "b2b") throw new AppError("FORBIDDEN", 403, "Business details are only for business accounts.");
    return user;
  }

  return {
    async me(userId: string): Promise<{ user: StoredUser; b2bProfile: StoredB2BProfile | null }> {
      const user = await currentUser(userId);
      return { user, b2bProfile: user.accountType === "b2b" ? await profiles.findByUserId(userId) : null };
    },

    async updateProfile(userId: string, patch: ProfilePatch): Promise<StoredUser> {
      const user = await users.update(userId, patch);
      if (!user) throw signedOut();
      return user;
    },

    // ends the other sign ins and gives this device a new one, see AuthService.changePassword
    changePassword(userId: string, currentPassword: string, newPassword: string): Promise<AuthSession> {
      return auth.changePassword(userId, currentPassword, newPassword);
    },

    async listAddresses(userId: string): Promise<StoredAddress[]> {
      return addresses.list(userId);
    },

    // the first address of a person is their default, and a later one only when they ask for it
    async createAddress(userId: string, input: AddressCreateInput): Promise<StoredAddress> {
      const existing = await addresses.list(userId);
      if (existing.length >= MAX_ADDRESSES) {
        throw new AppError("ADDRESS_LIMIT", 409, `You can keep up to ${MAX_ADDRESSES} addresses. Delete one to add another.`);
      }

      const { isDefault = false, ...fields } = input;
      const first = existing.length === 0;
      const created = await addresses.create(userId, { ...fields, isDefault: first });
      if (!first && isDefault) return (await addresses.setDefault(userId, created.id)) ?? created;
      return created;
    },

    async updateAddress(userId: string, id: string, patch: AddressPatch): Promise<StoredAddress> {
      const updated = await addresses.update(userId, id, patch);
      if (!updated) throw noSuchAddress();
      return updated;
    },

    // when the default goes, the oldest address that is left takes its place, so a person with addresses has a default
    async deleteAddress(userId: string, id: string): Promise<void> {
      const removed = await addresses.remove(userId, id);
      if (!removed) throw noSuchAddress();

      if (removed.isDefault) {
        const [oldest] = await addresses.list(userId);
        if (oldest) await addresses.setDefault(userId, oldest.id);
      }
    },

    async setDefaultAddress(userId: string, id: string): Promise<StoredAddress> {
      const address = await addresses.setDefault(userId, id);
      if (!address) throw noSuchAddress();
      return address;
    },

    async getBusinessProfile(userId: string): Promise<StoredB2BProfile> {
      await businessUser(userId);
      const profile = await profiles.findByUserId(userId);
      if (!profile) throw new AppError("NOT_FOUND", 404, "There are no business details yet.");
      return profile;
    },

    // creates the details or changes them. The verification is not part of what a person can send.
    async saveBusinessProfile(userId: string, input: B2BProfileBody): Promise<StoredB2BProfile> {
      await businessUser(userId);
      return profiles.save(userId, input);
    },

    // for our team: says whether the business was checked
    async setVerification(userId: string, status: VerificationStatus): Promise<StoredB2BProfile> {
      const profile = await profiles.setVerification(userId, status);
      if (!profile) throw new AppError("NOT_FOUND", 404, "That user has no business details.");
      return profile;
    },
  };
}

export type AccountService = ReturnType<typeof createAccountService>;
