// A limit on how often one visitor can call a route (by IP address, or by whatever keyBy returns, like a
// user id). When it is used up the answer is 429 in the standard error shape, with a Retry-After header.
// Requests that fail (a 4xx or 5xx answer) are not counted unless countFailedRequests is set, so a typo in
// a form does not use up a visitor's turns.
import type { Request, RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { AppError } from "../errors/AppError.ts";

interface RateLimitOptions {
  // how many requests are allowed in the window
  limit: number;
  windowMs: number;
  message: string;
  // count each person on their own by something other than the IP address, for example the user id
  keyBy?: (req: Request) => string;
  // count every request, including the ones that were refused
  countFailedRequests?: boolean;
}

export function createRateLimiter({ limit, windowMs, message, keyBy, countFailedRequests = false }: RateLimitOptions): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipFailedRequests: !countFailedRequests,
    ...(keyBy ? { keyGenerator: keyBy } : {}),
    handler: (_req, _res, next) => next(new AppError("RATE_LIMITED", 429, message)),
  });
}
