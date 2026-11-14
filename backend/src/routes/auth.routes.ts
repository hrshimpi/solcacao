// /api/auth
//   POST /register         anyone: creates an account (retail or business) and signs it in. 5 per hour per address.
//   POST /login            anyone: signs in. Wrong passwords count against the address, and the account locks after 5 in a row.
//   POST /refresh          the refresh cookie: a new access token (and a new cookie). The old cookie works once.
//   POST /logout           ends the sign in of this device, and answers 204 also when nobody was signed in
//   POST /forgot-password  anyone: sends a reset link when the address has an account. Always answers the same.
//   POST /reset-password   the token from the email and a new password: answers 204, every sign in of the account ends
// None of the answers is ever kept by a cache.
import { ipKeyGenerator } from "express-rate-limit";
import { Router, type Request, type RequestHandler } from "express";
import { env } from "../config/env.ts";
import { createAuthController } from "../controllers/auth.controller.ts";
import { createRateLimiter } from "../middleware/rateLimit.ts";
import { noStore } from "../middleware/security.ts";
import { createAuthService, type AuthService } from "../services/auth.service.ts";
import { createMongoB2BProfileStore } from "../services/b2b-profile.store.ts";
import * as mail from "../services/mail.service.ts";
import { hasher } from "../services/password.ts";
import { createMongoSessionStore } from "../services/session.store.ts";
import { createMongoUserStore } from "../services/user.store.ts";

interface AuthLimiters {
  register: RequestHandler;
  // for the routes where a guess is made (sign in, reset link): only the tries that failed count
  login: RequestHandler;
  // the reset email, limited for each address that is asked about and for each visitor
  forgot: RequestHandler[];
}

export function createAuthRouter({ service, limiters, secureCookie = env.COOKIE_SECURE }: { service: AuthService; limiters: AuthLimiters; secureCookie?: boolean }) {
  const controller = createAuthController(service, { secure: secureCookie, accessTokenMinutes: env.ACCESS_TOKEN_MINUTES });
  const router = Router();

  router.use(noStore);
  router.post("/register", limiters.register, controller.register);
  router.post("/login", limiters.login, controller.login);
  router.post("/refresh", controller.refresh);
  router.post("/logout", controller.logout);
  router.post("/forgot-password", ...limiters.forgot, controller.forgotPassword);
  router.post("/reset-password", limiters.login, controller.resetPassword);

  return router;
}

// the address, or the email that was sent, so that one person cannot fill another one's inbox with reset emails
const byEmailOrAddress = (req: Request) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase().slice(0, 254) : "";
  return email ? `email:${email}` : ipKeyGenerator(req.ip ?? "");
};

export function authLimiters(options: { loginLimit?: number; windowMs?: number } = {}): AuthLimiters {
  const windowMs = options.windowMs ?? env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;
  return {
    register: createRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000, message: "Too many accounts were made from this address. Please try again later.", countFailedRequests: true }),
    login: createRateLimiter({ limit: options.loginLimit ?? env.AUTH_RATE_LIMIT_MAX, windowMs, message: "Too many tries. Please wait a few minutes and try again.", onlyFailures: true }),
    forgot: [
      createRateLimiter({ limit: 3, windowMs: 60 * 60 * 1000, message: "Too many reset emails were asked for. Please try again in an hour.", keyBy: byEmailOrAddress, countFailedRequests: true }),
      createRateLimiter({ limit: 10, windowMs: 60 * 60 * 1000, message: "Too many reset emails were asked for. Please try again in an hour.", countFailedRequests: true }),
    ],
  };
}

export const authService = createAuthService({
  users: createMongoUserStore(),
  sessions: createMongoSessionStore(),
  profiles: createMongoB2BProfileStore(),
  mail,
  hasher,
  settings: {
    accessTokenMinutes: env.ACCESS_TOKEN_MINUTES,
    refreshTokenDays: env.REFRESH_TOKEN_DAYS,
    maxFailedLogins: 5,
    lockMinutes: 15,
    resetTokenMinutes: 60,
    reuseGraceSeconds: 10,
    siteUrl: env.SITE_URL,
  },
});

export const authRouter = createAuthRouter({ service: authService, limiters: authLimiters() });
