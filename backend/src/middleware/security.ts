// The protection every request goes through before a route sees it.
//   corsFor(origins)       only our own website may read answers from a browser (with cookies)
//   checkOrigin(origins)   a browser that sends changes (POST, PATCH, PUT, DELETE) from another website is refused,
//                          which stops a page of someone else from using the cookies of a signed in person
//   noStore                answers that belong to one person are never kept by a cache
// Requests without an Origin header (curl, other servers, our own tests) are not from a browser, so they pass:
// they have no cookies of anybody else's to misuse.
import cors from "cors";
import type { RequestHandler } from "express";
import { AppError } from "../errors/AppError.ts";
import { logger } from "../logger.ts";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export function corsFor(origins: string[]): RequestHandler {
  return cors({
    // a website that is not on the list simply gets no CORS headers, and the browser keeps the answer from the page
    origin: (origin, done) => done(null, origin === undefined || origins.includes(origin)),
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Accept", "Accept-Language", "Authorization", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id", "Retry-After"],
    maxAge: 600,
    // a preflight goes on to the routes, so Express answers it for an address that exists and an address that does not exist is a 404
    preflightContinue: true,
  });
}

export function checkOrigin(origins: string[]): RequestHandler {
  return (req, _res, next) => {
    const origin = req.headers.origin;
    if (safeMethods.has(req.method) || origin === undefined || origins.includes(origin)) {
      next();
      return;
    }

    logger.warn({ origin, method: req.method, url: req.path }, "refused a change from a website that is not in CLIENT_ORIGIN");
    next(new AppError("FORBIDDEN", 403, "That request came from a website we don't recognize."));
  };
}

export const noStore: RequestHandler = (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
};
