// One long lived login (a "refresh token"). The token itself is a random text that only lives in the person's
// cookie, here there is only its hash, so a copy of the database cannot be used to sign in.
// A token works once: using it swaps it for a new one (same family). If a token that was already used shows up
// again, somebody has a copy, so the whole family is revoked and the person has to sign in again.
import { model, Schema, type HydratedDocument, type Types } from "mongoose";

export interface RefreshSessionData {
  userId: Types.ObjectId;
  tokenHash: string;
  // all the tokens that came from one sign in
  family: string;
  expiresAt: Date;
  usedAt?: Date;
  revokedAt?: Date;
  createdAt: Date;
}

export type RefreshSessionDocument = HydratedDocument<RefreshSessionData>;

const refreshSessionSchema = new Schema<RefreshSessionData>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true },
    family: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
    revokedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

refreshSessionSchema.index({ tokenHash: 1 }, { unique: true });
refreshSessionSchema.index({ family: 1 });
refreshSessionSchema.index({ userId: 1 });

// MongoDB removes a session by itself some time after it expires
refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshSession = model<RefreshSessionData>("RefreshSession", refreshSessionSchema);
