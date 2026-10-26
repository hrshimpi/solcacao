// The B2BRequest model: one business quote request sent from the Corporate Cacao Studio.
// Brand files are stored as small embedded records. We keep the name the server saved the file
// under, never a public URL, so a file can only be reached through our own routes.
import { model, Schema, type HydratedDocument, type Types } from "mongoose";
import { jsonPlugin } from "../plugins/json.plugin.ts";

export const packagingTypes = ["foil_wrap", "rigid_box", "specimen_card", "paper_sleeve"] as const;
export const requestStatuses = ["submitted", "quoted", "approved", "rejected"] as const;

export type PackagingType = (typeof packagingTypes)[number];
export type RequestStatus = (typeof requestStatuses)[number];

export interface BrandAsset {
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
}

export interface B2BRequestData {
  userId: Types.ObjectId;
  companyName: string;
  contactName: string;
  cacaoProfile: string;
  packagingType: PackagingType;
  quantityEstimate: number;
  notes?: string;
  brandAssets: BrandAsset[];
  status: RequestStatus;
  quoteAmount: number | null;
  quoteNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type B2BRequestDocument = HydratedDocument<B2BRequestData>;

const wholeNumber = {
  validator: (value: number | null | undefined) => value === null || value === undefined || Number.isInteger(value),
  message: "{PATH} must be a whole number",
};

const brandAssetSchema = new Schema<BrandAsset>(
  {
    originalName: { type: String, required: true, trim: true },
    storedName: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    sizeBytes: { type: Number, required: true, min: 0, validate: wholeNumber },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const b2bRequestSchema = new Schema<B2BRequestData>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    companyName: { type: String, required: true, trim: true },
    contactName: { type: String, required: true, trim: true },
    // an origin name such as "Ecuador", or "custom" for a blend
    cacaoProfile: { type: String, required: true, trim: true },
    packagingType: { type: String, enum: packagingTypes, required: true },
    quantityEstimate: { type: Number, required: true, min: 1, validate: wholeNumber },
    notes: { type: String, trim: true, maxlength: 2000 },
    brandAssets: { type: [brandAssetSchema], default: [] },
    status: { type: String, enum: requestStatuses, default: "submitted" },
    // whole cents, stays null until someone quotes the request
    quoteAmount: { type: Number, default: null, min: 0, validate: wholeNumber },
    quoteNote: { type: String, trim: true },
  },
  { timestamps: true },
);

b2bRequestSchema.index({ userId: 1 });
b2bRequestSchema.index({ status: 1 });
b2bRequestSchema.index({ createdAt: -1 });

b2bRequestSchema.plugin(jsonPlugin);

export const B2BRequest = model<B2BRequestData>("B2BRequest", b2bRequestSchema);
