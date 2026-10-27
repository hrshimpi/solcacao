// Login tokens. A token is a signed JWT in the Authorization header ("Bearer <token>") that holds the id
// of the user, their role and the type of their account. The login routes that hand tokens out come later,
// signToken is what they will use.
//   optionalAuth:             sets req.user when the token is good, and lets everybody through, with or without one
//   requireAuth:              401 without a good token
//   requireAccountType(type): 403 for a signed in user whose account is another type (use it after requireAuth)
//   requireAdmin:             401 without a good token, 403 for someone who is not an admin
import type { RequestHandler, Request } from "express";
import { jwtVerify, SignJWT } from "jose";
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
export function signToken(user: Omit<AuthUser, "accountType"> & { accountType?: AccountType }, expiresIn: string | number = "1h"): Promise<string> {
  return new SignJWT({ role: user.role, accountType: user.accountType ?? "retail" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

// the user in the request's token, or undefined when there is no token or it is not good
// (wrong signature, expired, another algorithm, missing parts)
async function readUser(req: Request): Promise<AuthUser | undefined> {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? "");
  if (!match) return undefined;

  try {
    const { payload } = await jwtVerify(match[1], key, { algorithms: ["HS256"] });
    if (typeof payload.sub === "string" && (payload.role === "user" || payload.role === "admin")) {
      // anything that is not clearly a business account counts as retail, the safer choice
      return { id: payload.sub, role: payload.role, accountType: payload.accountType === "b2b" ? "b2b" : "retail" };
    }
  } catch {
    // a bad token is treated like no token
  }
  return undefined;
}

const notSignedIn = () => new AppError("UNAUTHENTICATED", 401, "Please sign in to do that.");
const notAllowed = () => new AppError("FORBIDDEN", 403, "You don't have access to that.");

export const optionalAuth: RequestHandler = async (req, _res, next) => {
  req.user = await readUser(req);
  next();
};

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const user = await readUser(req);
  if (!user) throw notSignedIn();
  req.user = user;
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
  const user = await readUser(req);
  if (!user) throw notSignedIn();
  if (user.role !== "admin") throw notAllowed();
  req.user = user;
  next();
};
