// The rules for inquiries: saving what visitors send (and emailing about it), the newsletter list,
// and the list and status change that admins use.
import { AppError } from "../errors/AppError.ts";
import type { InquiryStatus } from "../models/inquiry.model.ts";
import type { InquiryInput } from "../schemas/inquiry.schema.ts";
import { DuplicateInquiryError, type InquiryListQuery, type InquiryStore, type StoredInquiry } from "./inquiry.store.ts";
import type { InquiryMailData } from "./mail-templates.ts";

// the part of the mail service that we use
export interface InquiryMail {
  sendInquiryEmail(inquiry: InquiryMailData): Promise<boolean>;
  sendNewsletterWelcome(email: string, lang: string): Promise<boolean>;
}

interface SubmitContext {
  // the signed in user who wrote it, if there is one
  userId?: string;
  // the language of the visitor, for the newsletter welcome
  lang: string;
}

// The mail service never throws, but a request must not depend on that: this swallows anything that goes wrong.
function inTheBackground(send: () => Promise<unknown>) {
  try {
    send().catch(() => {});
  } catch {
    // nothing to do, the inquiry is saved and that is what the visitor needs
  }
}

export function createInquiryService({ store, mail }: { store: InquiryStore; mail: InquiryMail }) {
  async function submitNewsletter(input: Extract<InquiryInput, { category: "newsletter" }>, { userId, lang }: SubmitContext) {
    // someone who is already on the list gets the same answer as a new subscriber: no second record, no second email
    const existing = await store.findNewsletter(input.email);
    if (existing) return { id: existing.id };

    try {
      const saved = await store.create({ category: "newsletter", email: input.email, ...(userId ? { userId } : {}) });
      inTheBackground(() => mail.sendNewsletterWelcome(input.email, lang));
      return { id: saved.id };
    } catch (error) {
      // two sign ups for the same address at the same moment: the other one won
      if (!(error instanceof DuplicateInquiryError)) throw error;
      const winner = await store.findNewsletter(input.email);
      if (!winner) throw error;
      return { id: winner.id };
    }
  }

  return {
    async submit(input: InquiryInput, context: SubmitContext): Promise<{ id: string }> {
      if (input.category === "newsletter") return submitNewsletter(input, context);

      const saved = await store.create({ ...input, ...(context.userId ? { userId: context.userId } : {}) });
      inTheBackground(() =>
        mail.sendInquiryEmail({
          category: saved.category,
          name: saved.name,
          email: saved.email,
          message: saved.message,
          rating: saved.rating,
        }),
      );
      return { id: saved.id };
    },

    async list(query: InquiryListQuery) {
      const { items, total } = await store.list(query);
      return { items, page: query.page, limit: query.limit, total };
    },

    async setStatus(id: string, status: InquiryStatus): Promise<StoredInquiry> {
      const updated = await store.setStatus(id, status);
      if (!updated) throw new AppError("NOT_FOUND", 404, "That inquiry doesn't exist.");
      return updated;
    },
  };
}

export type InquiryService = ReturnType<typeof createInquiryService>;
