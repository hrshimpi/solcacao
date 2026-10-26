// /api/inquiries
//   POST   /       anyone, 5 per 15 minutes per IP. Saves the inquiry and sends the email (a welcome for the newsletter)
//   GET    /       admins: a page of inquiries, newest first, filtered by status and category
//   PATCH  /:id    admins: marks an inquiry new or responded
import { Router, type RequestHandler } from "express";
import { createInquiryController } from "../controllers/inquiry.controller.ts";
import { optionalAuth, requireAdmin } from "../middleware/auth.ts";
import { createRateLimiter } from "../middleware/rateLimit.ts";
import { createInquiryService, type InquiryService } from "../services/inquiry.service.ts";
import { createMongoInquiryStore } from "../services/inquiry.store.ts";
import * as mail from "../services/mail.service.ts";

export function createInquiryRouter({ service, limiter }: { service: InquiryService; limiter: RequestHandler }) {
  const controller = createInquiryController(service);
  const router = Router();

  router.post("/", limiter, optionalAuth, controller.create);
  router.get("/", requireAdmin, controller.list);
  router.patch("/:id", requireAdmin, controller.update);

  return router;
}

export const inquiryRateLimiter = (options: { limit?: number; windowMs?: number } = {}) =>
  createRateLimiter({
    limit: options.limit ?? 5,
    windowMs: options.windowMs ?? 15 * 60 * 1000,
    message: "You have sent a lot of messages. Please try again in a few minutes.",
  });

export const inquiryRouter = createInquiryRouter({
  service: createInquiryService({ store: createMongoInquiryStore(), mail }),
  limiter: inquiryRateLimiter(),
});
