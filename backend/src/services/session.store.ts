// Where the long lived logins (refresh tokens) are kept, as hashes only. See the RefreshSession model for how
// a token is used once and then swapped for a new one.
import mongoose from "mongoose";
import { requireDatabase } from "../config/db.ts";
import { RefreshSession } from "../models/refresh-session.model.ts";
import { objectIdPattern } from "./user.store.ts";

export interface NewSession {
  userId: string;
  tokenHash: string;
  family: string;
  expiresAt: Date;
}

// what using a token leads to
export type Consumed =
  // a good token, now used up: the caller gives out a new one in the same family
  | { status: "ok"; userId: string; family: string }
  // a token that was already used. usedAt tells how long ago, since two tabs can ask at the very same moment.
  | { status: "reused"; userId: string; family: string; usedAt: Date }
  // never existed, ran out, or was revoked by a sign out
  | { status: "unknown" };

export interface SessionStore {
  create(session: NewSession): Promise<void>;
  consume(tokenHash: string, now: Date): Promise<Consumed>;
  // ends every token that came from one sign in
  revokeFamily(family: string, now: Date): Promise<void>;
  // ends the sign in a token belongs to (a sign out)
  revokeByToken(tokenHash: string, now: Date): Promise<void>;
  // ends all the sign ins of a user (a new password, a reset)
  revokeUser(userId: string, now: Date): Promise<void>;
}

export function createMongoSessionStore(): SessionStore {
  return {
    async create(session) {
      requireDatabase();
      await RefreshSession.create(session);
    },

    async consume(tokenHash, now) {
      requireDatabase();
      // the check and the marking are one step, so two requests with the same token cannot both win
      const used = await RefreshSession.findOneAndUpdate(
        { tokenHash, usedAt: null, revokedAt: null, expiresAt: mongoose.trusted({ $gt: now }) },
        { $set: { usedAt: now } },
      );
      if (used) return { status: "ok", userId: String(used.userId), family: used.family };

      const known = await RefreshSession.findOne({ tokenHash });
      if (known?.usedAt && !known.revokedAt && known.expiresAt > now) {
        return { status: "reused", userId: String(known.userId), family: known.family, usedAt: known.usedAt };
      }
      return { status: "unknown" };
    },

    async revokeFamily(family, now) {
      requireDatabase();
      await RefreshSession.updateMany({ family, revokedAt: null }, { $set: { revokedAt: now } });
    },

    async revokeByToken(tokenHash, now) {
      requireDatabase();
      const known = await RefreshSession.findOne({ tokenHash });
      if (known) await RefreshSession.updateMany({ family: known.family, revokedAt: null }, { $set: { revokedAt: now } });
    },

    async revokeUser(userId, now) {
      requireDatabase();
      if (!objectIdPattern.test(userId)) return;
      await RefreshSession.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: now } });
    },
  };
}
