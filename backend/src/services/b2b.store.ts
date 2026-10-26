// Where quote requests are kept. Like the inquiry store, the service only talks to this interface, so the
// tests can use a store in memory and the real server uses MongoDB.
import { requireDatabase } from "../config/db.ts";
import { B2BRequest, type B2BRequestDocument, type PackagingType, type RequestStatus } from "../models/b2b-request.model.ts";
import type { StoredUpload } from "../middleware/upload.ts";

// a brand file as the API shows it. There is no public address: files are only reachable through our own routes
export interface StoredBrandAsset {
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

// a quote request as the API shows it
export interface StoredB2BRequest {
  id: string;
  userId: string;
  companyName: string;
  contactName: string;
  cacaoProfile: string;
  packagingType: PackagingType;
  quantityEstimate: number;
  notes?: string;
  brandAssets: StoredBrandAsset[];
  status: RequestStatus;
  // whole cents, null until someone quotes the request
  quoteAmount: number | null;
  quoteNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewB2BRequest {
  userId: string;
  companyName: string;
  contactName: string;
  cacaoProfile: string;
  packagingType: PackagingType;
  quantityEstimate: number;
  notes?: string;
  brandAssets: StoredUpload[];
}

export interface B2BRequestStore {
  // saves a new request (status "submitted", no quote yet)
  create(data: NewB2BRequest): Promise<StoredB2BRequest>;
}

function toStored(doc: B2BRequestDocument): StoredB2BRequest {
  return {
    id: String(doc._id),
    userId: String(doc.userId),
    companyName: doc.companyName,
    contactName: doc.contactName,
    cacaoProfile: doc.cacaoProfile,
    packagingType: doc.packagingType,
    quantityEstimate: doc.quantityEstimate,
    notes: doc.notes ?? undefined,
    brandAssets: doc.brandAssets.map((asset) => ({
      originalName: asset.originalName,
      storedName: asset.storedName,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      uploadedAt: asset.uploadedAt.toISOString(),
    })),
    status: doc.status,
    quoteAmount: doc.quoteAmount ?? null,
    quoteNote: doc.quoteNote ?? undefined,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function createMongoB2BRequestStore(): B2BRequestStore {
  return {
    async create(data) {
      requireDatabase();
      return toStored(await B2BRequest.create(data));
    },
  };
}
