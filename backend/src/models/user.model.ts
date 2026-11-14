// The User model: one account. Passwords are only ever kept as a bcrypt hash, and the fields that are secrets
// (the hash, the failed login count, the reset token) are marked private so toJSON leaves them out, and
// select: false so a query only returns them when it asks for them by name.
import { model, Schema, type HydratedDocument } from "mongoose";
import { jsonPlugin } from "../plugins/json.plugin.ts";

export const userRoles = ["user", "admin"] as const;
export const accountTypes = ["retail", "b2b"] as const;
export const languages = ["en", "es"] as const;

export type UserRole = (typeof userRoles)[number];
export type UserAccountType = (typeof accountTypes)[number];
export type UserLanguage = (typeof languages)[number];

export interface UserData {
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  accountType: UserAccountType;
  phone?: string;
  preferredLanguage: UserLanguage;
  // whether the person wants emails about new releases
  marketingEmails: boolean;
  // wrong passwords in a row, and until when the account is locked because of them
  failedLogins: number;
  lockedUntil?: Date;
  // only the hash of the reset token is kept, the token itself is only in the email
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
  passwordChangedAt?: Date;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<UserData>;

const userSchema = new Schema<UserData>(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "{PATH} must be a valid email address"],
    },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    passwordHash: { type: String, required: true, select: false, private: true },
    role: { type: String, enum: userRoles, default: "user", required: true },
    accountType: { type: String, enum: accountTypes, default: "retail", required: true },
    phone: { type: String, trim: true, maxlength: 30, match: [/^[0-9+()\-.\s]{5,30}$/, "{PATH} must look like a phone number"] },
    preferredLanguage: { type: String, enum: languages, default: "en", required: true },
    marketingEmails: { type: Boolean, default: false },
    failedLogins: { type: Number, default: 0, min: 0, select: false, private: true },
    lockedUntil: { type: Date, select: false, private: true },
    passwordResetTokenHash: { type: String, select: false, private: true },
    passwordResetExpiresAt: { type: Date, select: false, private: true },
    passwordChangedAt: { type: Date, private: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

// one account per email address, even when two sign ups arrive at the same moment
userSchema.index({ email: 1 }, { unique: true });

// finds the account that a reset link belongs to
userSchema.index({ passwordResetTokenHash: 1 }, { sparse: true });

userSchema.plugin(jsonPlugin);

export const User = model<UserData>("User", userSchema);
