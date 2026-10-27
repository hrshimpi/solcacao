// Where inquiries are kept. The service only talks to the InquiryStore interface, so the tests can use a
// store that lives in memory and the real server uses the MongoDB one below.
import { isDatabaseReady } from "../config/db.ts";
import { AppError } from "../errors/AppError.ts";
import { Inquiry, type InquiryCategory, type InquiryDocument, type InquiryStatus } from "../models/inquiry.model.ts";

// an inquiry as the API shows it
export interface StoredInquiry {
  id: string;
  userId?: string;
  name?: string;
  email?: string;
  category: InquiryCategory;
  message?: string;
  rating?: number;
  status: InquiryStatus;
  // an ISO date, like "2026-10-27T15:04:05.000Z"
  createdAt: string;
}

export interface NewInquiry {
  userId?: string;
  name?: string;
  email?: string;
  category: InquiryCategory;
  message?: string;
  rating?: number;
}

export interface InquiryListQuery {
  status?: InquiryStatus;
  category?: InquiryCategory;
  page: number;
  limit: number;
}

export interface InquiryStore {
  // saves a new inquiry (status "new"). Throws DuplicateInquiryError for a newsletter address that is already there
  create(data: NewInquiry): Promise<StoredInquiry>;
  findNewsletter(email: string): Promise<StoredInquiry | null>;
  // newest first
  list(query: InquiryListQuery): Promise<{ items: StoredInquiry[]; total: number }>;
  // null when there is no inquiry with that id
  setStatus(id: string, status: InquiryStatus): Promise<StoredInquiry | null>;
}

export class DuplicateInquiryError extends Error {
  constructor() {
    super("That newsletter address is already subscribed.");
    this.name = "DuplicateInquiryError";
  }
}

function toStored(doc: InquiryDocument): StoredInquiry {
  return {
    id: String(doc._id),
    userId: doc.userId ? String(doc.userId) : undefined,
    name: doc.name ?? undefined,
    email: doc.email ?? undefined,
    category: doc.category,
    message: doc.message ?? undefined,
    rating: doc.rating ?? undefined,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
  };
}

// no connection means a clear 503 right away, not a request that hangs until a timeout
function ensureDatabase() {
  if (!isDatabaseReady()) {
    throw new AppError("DATABASE_UNAVAILABLE", 503, "We can't reach the database right now. Please try again in a moment.");
  }
}

export function createMongoInquiryStore(): InquiryStore {
  return {
    async create(data) {
      ensureDatabase();
      try {
        return toStored(await Inquiry.create(data));
      } catch (error) {
        // 11000 is MongoDB's "duplicate key", from the unique index on newsletter addresses
        if ((error as { code?: number }).code === 11000) throw new DuplicateInquiryError();
        throw error;
      }
    },

    async findNewsletter(email) {
      ensureDatabase();
      const doc = await Inquiry.findOne({ category: "newsletter", email });
      return doc ? toStored(doc) : null;
    },

    async list({ status, category, page, limit }) {
      ensureDatabase();
      const filter: { status?: InquiryStatus; category?: InquiryCategory } = {};
      if (status) filter.status = status;
      if (category) filter.category = category;

      const [docs, total] = await Promise.all([
        // the id breaks ties, so two inquiries from the same moment always come in the same order
        Inquiry.find(filter)
          .sort({ createdAt: -1, _id: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        Inquiry.countDocuments(filter),
      ]);
      return { items: docs.map(toStored), total };
    },

    async setStatus(id, status) {
      ensureDatabase();
      const doc = await Inquiry.findByIdAndUpdate(id, { status }, { returnDocument: "after", runValidators: true });
      return doc ? toStored(doc) : null;
    },
  };
}
