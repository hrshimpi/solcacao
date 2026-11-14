// The rules for quote requests: saving one with its brand files, telling the team, cleaning up the files
// when the request does not go through, and who may see a request, its files and change its status.
import type { Readable } from "node:stream";
import { AppError } from "../errors/AppError.ts";
import type { AuthUser } from "../middleware/auth.ts";
import type { StoredUpload } from "../middleware/upload.ts";
import type { StatusChangeInput } from "../schemas/b2b-requests.schema.ts";
import type { QuoteRequestInput } from "../schemas/b2b.schema.ts";
import { inTheBackground } from "./background.ts";
import type { B2BListQuery, B2BRequestStore, StoredB2BRequest, StoredBrandAsset } from "./b2b.store.ts";
import type { MailRecipient, QuoteRequestMailData } from "./mail-templates.ts";
import type { ProfileLookup, UserProfile } from "./profile.service.ts";
import { canChange, invalidTransition } from "./request-status.ts";
import type { StorageService } from "./storage.service.ts";

// the part of the mail service that we use
export interface QuoteMail {
  sendQuoteNotification(request: QuoteRequestMailData, user: MailRecipient): Promise<boolean>;
}

interface Dependencies {
  store: B2BRequestStore;
  storage: StorageService;
  mail: QuoteMail;
  profiles: ProfileLookup;
}

// who is asking: an admin sees every request, anybody else only their own
export type Viewer = Pick<AuthUser, "id" | "role">;

// a request that is someone else's looks exactly like one that is not there, so ids cannot be probed
const requestNotFound = () => new AppError("NOT_FOUND", 404, "We couldn't find that request.");
const fileNotFound = () => new AppError("FILE_NOT_FOUND", 404, "That file doesn't exist.");

function mayOpen(request: StoredB2BRequest, viewer: Viewer): boolean {
  return viewer.role === "admin" || request.userId === viewer.id.toLowerCase();
}

export function createB2BService({ store, storage, mail, profiles }: Dependencies) {
  // deletes brand files that were stored for a request that failed. A file that is already gone is fine.
  async function discardUploads(uploads: StoredUpload[]): Promise<void> {
    await Promise.allSettled(uploads.map((upload) => storage.remove(upload.storedName)));
  }

  async function get(id: string, viewer: Viewer): Promise<StoredB2BRequest> {
    const found = await store.findById(id);
    if (!found || !mayOpen(found, viewer)) throw requestNotFound();
    return found;
  }

  return {
    discardUploads,

    // what we know about the user. A user we know nothing about is not an error.
    async profileOf(userId: string): Promise<UserProfile> {
      try {
        return await profiles(userId);
      } catch {
        return {};
      }
    },

    async createQuote(input: QuoteRequestInput, uploads: StoredUpload[], user: { id: string; profile: UserProfile }): Promise<StoredB2BRequest> {
      let saved: StoredB2BRequest;
      try {
        saved = await store.create({ ...input, userId: user.id, brandAssets: uploads });
      } catch (error) {
        // the files were stored before the request was, so they are not wanted any more
        await discardUploads(uploads);
        throw error;
      }

      // the team is told after the request is saved. If that fails nothing else does: the request is safe.
      inTheBackground(() => mail.sendQuoteNotification(saved, { email: user.profile.email ?? "", name: saved.contactName }));
      return saved;
    },

    // the requests of one user, newest first
    async listFor(userId: string, { page, limit }: B2BListQuery) {
      const { items, total } = await store.listForUser(userId, { page, limit });
      return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
    },

    get,

    // a brand file of a request, for the owner or an admin. A file name that is not one of the request's own
    // files is "not found" before the storage is asked, so a name can never be used to reach another file.
    async openAsset(id: string, storedName: string, viewer: Viewer): Promise<{ asset: StoredBrandAsset; content: Readable }> {
      const request = await get(id, viewer);
      const asset = request.brandAssets.find((candidate) => candidate.storedName === storedName);
      if (!asset) throw fileNotFound();
      return { asset, content: await storage.stream(asset.storedName) };
    },

    async changeStatus(id: string, change: StatusChangeInput): Promise<StoredB2BRequest> {
      const current = await store.findById(id);
      if (!current) throw requestNotFound();
      if (!canChange(current.status, change.status)) throw invalidTransition(current.status, change.status);

      // the store only changes the request if it still has the status we just checked
      const updated = await store.transition(id, current.status, change);
      if (!updated) throw new AppError("REQUEST_CHANGED", 409, "Someone just changed this request. Please reload it and try again.");
      return updated;
    },
  };
}

export type B2BService = ReturnType<typeof createB2BService>;
