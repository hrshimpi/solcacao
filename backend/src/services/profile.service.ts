// What we know about a signed in user, used to fill in the parts of a form they left out (the quote request takes
// the contact name and the company from here). It never fails a request: when something is missing or the
// database is not there, it simply knows less.
import { createMongoB2BProfileStore, type B2BProfileStore } from "./b2b-profile.store.ts";
import { createMongoUserStore, type UserStore } from "./user.store.ts";

export interface UserProfile {
  email?: string;
  // the person's own name
  name?: string;
  companyName?: string;
}

export type ProfileLookup = (userId: string) => Promise<UserProfile>;

export function createProfileLookup({ users, profiles }: { users: UserStore; profiles: B2BProfileStore }): ProfileLookup {
  return async (userId) => {
    try {
      const [user, business] = await Promise.all([users.findById(userId), profiles.findByUserId(userId)]);
      return { email: user?.email, name: user?.name, companyName: business?.companyName };
    } catch {
      return {};
    }
  };
}

export function createMongoProfileLookup(): ProfileLookup {
  return createProfileLookup({ users: createMongoUserStore(), profiles: createMongoB2BProfileStore() });
}
