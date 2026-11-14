// Login tokens. A token is a signed JWT in the Authorization header ("Bearer <token>") that holds the id
// of the user, their role and the type of their account. It is short lived (see ACCESS_TOKEN_MINUTES): the
// auth routes hand it out together with a long lived refresh cookie that gets a new one.
//   optionalAuth:             sets req.user when the token is good, and lets everybody through, with or without one
//   requireAuth:              401 without a good token (TOKEN_EXPIRED when it was good but ran out, so a client knows to refresh)
//   requireAccountType(type): 403 for a signed in user whose account is another type (use it after requireAuth)
//   requireAdmin:             401 without a good token, 403 for someone who is not an admin
//   requireStaff:             an admin's token, or the staff key in the X-Staff-Key header (for the team's own tools)
import { createHash, timingSafeEqual } from "node:crypto";
import type { RequestHandler, Request } from "express";
import { errors, jwtVerify, SignJWT } from "jose";
import { env } from "../config/env.ts";
import { AppError } from "../errors/AppError.ts";

export type Role = "user" | "admin";
export type AccountType = "retail" | "b2b";

export interface AuthUser {
  id: string;
  role: Role;
  accountType: AccountType;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const key = new TextEncoder().encode(env.JWT_SECRET);

// accountType is retail when it is left out
export function signToken(
  user: Omit<AuthUser, "accountType"> & { accountType?: AccountType },
  expiresIn: string | number = `${env.ACCESS_TOKEN_MINUTES}m`,
): Promise<string> {
  return new SignJWT({ role: user.role, accountType: user.accountType ?? "retail" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

type Reading = { user: AuthUser } | { problem: "none" | "bad" | "expired" };

// the user in the request's token, or what is wrong with it (no token, wrong signature, another algorithm,
// missing parts, or a good token that ran out)
async function readUser(req: Request): Promise<Reading> {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? "");
  if (!match) return { problem: "none" };

  try {
    const { payload } = await jwtVerify(match[1], key, { algorithms: ["HS256"] });
    if (typeof payload.sub === "string" && (payload.role === "user" || payload.role === "admin")) {
      // anything that is not clearly a business account counts as retail, the safer choice
      return { user: { id: payload.sub, role: payload.role, accountType: payload.accountType === "b2b" ? "b2b" : "retail" } };
    }
  } catch (error) {
    if (error instanceof errors.JWTExpired) return { problem: "expired" };
  }
  return { problem: "bad" };
}

const notSignedIn = () => new AppError("UNAUTHENTICATED", 401, "Please sign in to do that.");
const sessionExpired = () => new AppError("TOKEN_EXPIRED", 401, "Your session ran out. Please sign in again.");
const notAllowed = () => new AppError("FORBIDDEN", 403, "You don't have access to that.");

// the user of a request that has to be signed in, or the right error
async function mustBeSignedIn(req: Request): Promise<AuthUser> {
  const reading = await readUser(req);
  if ("user" in reading) return reading.user;
  throw reading.problem === "expired" ? sessionExpired() : notSignedIn();
}

export const optionalAuth: RequestHandler = async (req, _res, next) => {
  const reading = await readUser(req);
  req.user = "user" in reading ? reading.user : undefined;
  next();
};

export const requireAuth: RequestHandler = async (req, _res, next) => {
  req.user = await mustBeSignedIn(req);
  next();
};

export function requireAccountType(accountType: AccountType): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) throw notSignedIn();
    if (req.user.accountType !== accountType) throw notAllowed();
    next();
  };
}

export const requireAdmin: RequestHandler = async (req, _res, next) => {
  const user = await mustBeSignedIn(req);
  if (user.role !== "admin") throw notAllowed();
  req.user = user;
  next();
};

// hashing both sides gives them the same length, which timingSafeEqual needs, and keeps the compare from leaking the length of the key
const digest = (value: string) => createHash("sha256").update(value).digest();

export function staffKeyMatches(sent: unknown, expected: string): boolean {
  if (expected === "" || typeof sent !== "string" || sent === "") return false;
  return timingSafeEqual(digest(sent), digest(expected));
}

// with the key of the team's tools the request goes through without a user, otherwise it has to be an admin
export function createRequireStaff(getKey: () => string): RequestHandler {
  return async (req, _res, next) => {
    if (staffKeyMatches(req.headers["x-staff-key"], getKey())) {
      next();
      return;
    }
    const user = await mustBeSignedIn(req);
    if (user.role !== "admin") throw notAllowed();
    req.user = user;
    next();
  };
}

export const requireStaff = createRequireStaff(() => env.STAFF_API_KEY);
