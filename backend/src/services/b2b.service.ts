// The rules for quote requests: saving one with its brand files, telling the team, and cleaning up the files
// when the request does not go through.
import type { StoredUpload } from "../middleware/upload.ts";
import type { QuoteRequestInput } from "../schemas/b2b.schema.ts";
import { inTheBackground } from "./background.ts";
import type { B2BRequestStore, StoredB2BRequest } from "./b2b.store.ts";
import type { MailRecipient, QuoteRequestMailData } from "./mail-templates.ts";
import type { ProfileLookup, UserProfile } from "./profile.service.ts";
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

export function createB2BService({ store, storage, mail, profiles }: Dependencies) {
  // deletes brand files that were stored for a request that failed. A file that is already gone is fine.
  async function discardUploads(uploads: StoredUpload[]): Promise<void> {
    await Promise.allSettled(uploads.map((upload) => storage.remove(upload.storedName)));
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
  };
}

export type B2BService = ReturnType<typeof createB2BService>;
