// The business details of a business account. The person edits the company, tax id and industry themselves,
// but the verification status is only changed by our team: no route of the account area writes it.
import { model, Schema, type HydratedDocument, type Types } from "mongoose";
import { jsonPlugin } from "../plugins/json.plugin.ts";

export const verificationStatuses = ["pending", "verified", "rejected"] as const;
export type VerificationStatus = (typeof verificationStatuses)[number];

export interface B2BProfileData {
  userId: Types.ObjectId;
  companyName: string;
  taxId?: string;
  industry?: string;
  verificationStatus: VerificationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type B2BProfileDocument = HydratedDocument<B2BProfileData>;

const b2bProfileSchema = new Schema<B2BProfileData>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    companyName: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    taxId: { type: String, trim: true, maxlength: 40 },
    industry: { type: String, trim: true, maxlength: 80 },
    verificationStatus: { type: String, enum: verificationStatuses, default: "pending", required: true },
  },
  { timestamps: true },
);

// one set of business details for each account
b2bProfileSchema.index({ userId: 1 }, { unique: true });

b2bProfileSchema.plugin(jsonPlugin);

export const B2BProfile = model<B2BProfileData>("B2BProfile", b2bProfileSchema);
