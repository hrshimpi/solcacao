// What we know about a signed in user, used to fill in the parts of a form they left out.
// There are no user accounts in this repo yet, so this reads the "users" collection loosely: it looks for a
// name (or a first and a last name), a company name and an email under the names accounts usually use,
// and when something is missing or the database is not there it simply knows less. It never fails a request.
import mongoose from "mongoose";
import { isDatabaseReady } from "../config/db.ts";

export interface UserProfile {
  email?: string;
  // the person's own name
  name?: string;
  companyName?: string;
}

export type ProfileLookup = (userId: string) => Promise<UserProfile>;

function words(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

// turns a saved user document into the few things we use
export function profileFrom(doc: Record<string, unknown> | null | undefined): UserProfile {
  if (!doc) return {};
  const business = typeof doc.b2bProfile === "object" && doc.b2bProfile !== null ? (doc.b2bProfile as Record<string, unknown>) : {};

  const fullName = [words(doc.firstName), words(doc.lastName)].filter(Boolean).join(" ");
  return {
    email: words(doc.email),
    name: words(doc.name) ?? (fullName || undefined),
    companyName: words(doc.companyName) ?? words(business.companyName) ?? words(doc.company),
  };
}

export function createMongoProfileLookup(): ProfileLookup {
  return async (userId) => {
    if (!isDatabaseReady() || !mongoose.isValidObjectId(userId)) return {};
    try {
      const doc = await mongoose.connection.collection("users").findOne({ _id: new mongoose.Types.ObjectId(userId) });
      return profileFrom(doc);
    } catch {
      return {};
    }
  };
}
