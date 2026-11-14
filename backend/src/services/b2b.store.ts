// Where quote requests are kept. Like the inquiry store, the service only talks to this interface, so the
// tests can use a store in memory and the real server uses MongoDB.
import { requireDatabase } from "../config/db.ts";
import { B2BRequest, type B2BRequestData, type B2BRequestDocument, type PackagingType, type RequestStatus } from "../models/b2b-request.model.ts";
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

export interface B2BListQuery {
  page: number;
  limit: number;
}

// what an admin changes: the status, and with a quote its amount in whole cents and a note
export interface StatusChange {
  status: RequestStatus;
  quoteAmount?: number;
  quoteNote?: string;
}

export interface B2BRequestStore {
  // saves a new request (status "submitted", no quote yet)
  create(data: NewB2BRequest): Promise<StoredB2BRequest>;
  // null when there is no request with that id
  findById(id: string): Promise<StoredB2BRequest | null>;
  // the requests of one user, newest first
  listForUser(userId: string, query: B2BListQuery): Promise<{ items: StoredB2BRequest[]; total: number }>;
  // changes the status only if the request still has the status `from`, so two admins cannot both win.
  // null when there is no such request (or it has another status by now).
  transition(id: string, from: RequestStatus, change: StatusChange): Promise<StoredB2BRequest | null>;
}

// the id MongoDB makes. Anything else cannot be a request, and would only make the database complain.
const objectIdPattern = /^[0-9a-f]{24}$/i;

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

    async findById(id) {
      requireDatabase();
      if (!objectIdPattern.test(id)) return null;
      const doc = await B2BRequest.findById(id);
      return doc ? toStored(doc) : null;
    },

    async listForUser(userId, { page, limit }) {
      requireDatabase();
      if (!objectIdPattern.test(userId)) return { items: [], total: 0 };

      const [docs, total] = await Promise.all([
        // the id breaks ties, so two requests from the same moment always come in the same order
        B2BRequest.find({ userId })
          .sort({ createdAt: -1, _id: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        B2BRequest.countDocuments({ userId }),
      ]);
      return { items: docs.map(toStored), total };
    },

    async transition(id, from, change) {
      requireDatabase();
      if (!objectIdPattern.test(id)) return null;

      const changes: Partial<Pick<B2BRequestData, "status" | "quoteAmount" | "quoteNote">> = { status: change.status };
      if (change.quoteAmount !== undefined) changes.quoteAmount = change.quoteAmount;
      if (change.quoteNote !== undefined) changes.quoteNote = change.quoteNote;

      const doc = await B2BRequest.findOneAndUpdate({ _id: id, status: from }, { $set: changes }, { returnDocument: "after", runValidators: true });
      return doc ? toStored(doc) : null;
    },
  };
}
