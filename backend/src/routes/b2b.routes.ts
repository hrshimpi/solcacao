// /api/b2b
//   POST /quote   business accounts only: a quote request as a multipart form, with up to 5 brand files in
//                 the field "brandAssets". 10 requests per hour for each user.
// The order matters: sign in and account type first, then the limit, and only then are the files read.
import { Router, type RequestHandler } from "express";
import { createB2BController } from "../controllers/b2b.controller.ts";
import { requireAccountType, requireAuth } from "../middleware/auth.ts";
import { createRateLimiter } from "../middleware/rateLimit.ts";
import { uploadBrandAssets } from "../middleware/upload.ts";
import { createB2BService, type B2BService } from "../services/b2b.service.ts";
import { createMongoB2BRequestStore } from "../services/b2b.store.ts";
import * as mail from "../services/mail.service.ts";
import { createMongoProfileLookup } from "../services/profile.service.ts";
import { storage } from "../services/storage.service.ts";

export function createB2BRouter({ service, upload, limiter }: { service: B2BService; upload: RequestHandler; limiter: RequestHandler }) {
  const controller = createB2BController(service);
  const router = Router();

  router.post("/quote", requireAuth, requireAccountType("b2b"), limiter, upload, controller.createQuote);

  return router;
}

// every request counts, also the ones that were refused, because even a refused one can carry big files
export const quoteRateLimiter = (options: { limit?: number; windowMs?: number } = {}) =>
  createRateLimiter({
    limit: options.limit ?? 10,
    windowMs: options.windowMs ?? 60 * 60 * 1000,
    message: "You have sent a lot of quote requests. Please try again in an hour.",
    keyBy: (req) => req.user?.id ?? "nobody",
    countFailedRequests: true,
  });

export const b2bRouter = createB2BRouter({
  service: createB2BService({ store: createMongoB2BRequestStore(), storage, mail, profiles: createMongoProfileLookup() }),
  upload: uploadBrandAssets,
  limiter: quoteRateLimiter(),
});
