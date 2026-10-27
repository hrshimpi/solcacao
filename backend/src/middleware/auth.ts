// Login tokens. A token is a signed JWT in the Authorization header ("Bearer <token>") that holds
// the id of the user and their role. The login routes that hand tokens out come later, signToken is
// what they will use.
//   optionalAuth: sets req.user when the token is good, and lets everybody through, with or without one
//   requireAdmin: only lets admins through (401 without a good token, 403 for someone who is not an admin)
import type { RequestHandler, Request } from "express";
import { jwtVerify, SignJWT } from "jose";
import { env } from "../config/env.ts";
import { AppError } from "../errors/AppError.ts";

export type Role = "user" | "admin";

export interface AuthUser {
  id: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const key = new TextEncoder().encode(env.JWT_SECRET);

export function signToken(user: AuthUser, expiresIn: string | number = "1h"): Promise<string> {
  return new SignJWT({ role: user.role })
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
      return { id: payload.sub, role: payload.role };
    }
  } catch {
    // a bad token is treated like no token
  }
  return undefined;
}

export const optionalAuth: RequestHandler = async (req, _res, next) => {
  req.user = await readUser(req);
  next();
};

export const requireAdmin: RequestHandler = async (req, _res, next) => {
  const user = await readUser(req);
  if (!user) throw new AppError("UNAUTHENTICATED", 401, "Please sign in to do that.");
  if (user.role !== "admin") throw new AppError("FORBIDDEN", 403, "You don't have access to that.");
  req.user = user;
  next();
};
