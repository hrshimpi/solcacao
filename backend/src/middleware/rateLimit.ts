// A limit on how often one IP address can call a route. When it is used up the answer is 429 in the
// standard error shape, with a Retry-After header. Requests that fail (a 4xx or 5xx answer) are not
// counted, so a typo in a form does not use up a visitor's turns.
import type { RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { AppError } from "../errors/AppError.ts";

interface RateLimitOptions {
  // how many requests are allowed in the window
  limit: number;
  windowMs: number;
  message: string;
}

export function createRateLimiter({ limit, windowMs, message }: RateLimitOptions): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipFailedRequests: true,
    handler: (_req, _res, next) => next(new AppError("RATE_LIMITED", 429, message)),
  });
}
