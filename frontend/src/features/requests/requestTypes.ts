// A quote request as the API shows it (GET /api/b2b/requests), the part of it that the page uses, and the reading of
// the answer. The answer is read with care: a field that is missing or of the wrong kind becomes an empty one, and an
// item without an id is left out, so a surprise from the server never breaks the page.

export const knownStatuses = ["submitted", "quoted", "approved", "rejected"] as const;
export type KnownStatus = (typeof knownStatuses)[number];

export function isKnownStatus(status: string): status is KnownStatus {
  return (knownStatuses as readonly string[]).includes(status);
}

export interface BrandAsset {
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface QuoteRequest {
  id: string;
  companyName: string;
  contactName: string;
  cacaoProfile: string;
  packagingType: string;
  quantityEstimate: number;
  notes: string;
  brandAssets: BrandAsset[];
  // one of knownStatuses, or whatever the server sent if it grows a new one
  status: string;
  // whole cents, null until the request is quoted
  quoteAmount: number | null;
  quoteNote: string;
  createdAt: string;
}

export interface RequestList {
  items: QuoteRequest[];
  // how many requests the person has in all, which can be more than the items that came back
  total: number;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === "string" ? value : "");
const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

function readAsset(value: unknown): BrandAsset | null {
  if (!isObject(value) || typeof value.originalName !== "string" || typeof value.storedName !== "string") return null;
  return { originalName: value.originalName, storedName: value.storedName, mimeType: text(value.mimeType), sizeBytes: count(value.sizeBytes) };
}

function readRequest(value: unknown): QuoteRequest | null {
  if (!isObject(value) || typeof value.id !== "string" || value.id === "") return null;
  return {
    id: value.id,
    companyName: text(value.companyName),
    contactName: text(value.contactName),
    cacaoProfile: text(value.cacaoProfile),
    packagingType: text(value.packagingType),
    quantityEstimate: count(value.quantityEstimate),
    notes: text(value.notes),
    brandAssets: Array.isArray(value.brandAssets) ? value.brandAssets.map(readAsset).filter((asset): asset is BrandAsset => asset !== null) : [],
    status: text(value.status) || "submitted",
    quoteAmount: typeof value.quoteAmount === "number" && Number.isFinite(value.quoteAmount) ? value.quoteAmount : null,
    quoteNote: text(value.quoteNote),
    createdAt: text(value.createdAt),
  };
}

// the list from the answer of the server, or null when the answer is not a list at all
export function parseRequestList(data: unknown): RequestList | null {
  if (!isObject(data) || !Array.isArray(data.items)) return null;
  const items = data.items.map(readRequest).filter((request): request is QuoteRequest => request !== null);
  return { items, total: typeof data.total === "number" && data.total >= items.length ? data.total : items.length };
}
