// /api/users/me   (everything here needs a signed in user, and only ever touches that user's own records)
//   GET    /                       the user, and the business details of a business account
//   PATCH  /                       name, phone, preferredLanguage, marketingEmails. The email, the role and the type of account cannot be changed
//   PATCH  /password               { currentPassword, newPassword }: ends the other sign ins and answers with a new one for this device.
//                                  5 wrong current passwords per 15 minutes
//   GET    /addresses              the saved addresses, the oldest first
//   POST   /addresses              a new address (up to 10). The first one is the default, a later one when "isDefault" is true
//   PATCH  /addresses/:id          changes parts of an address
//   DELETE /addresses/:id          takes one away, the oldest that is left becomes the default when the default went
//   POST   /addresses/:id/default  makes this address the default
//   GET    /b2b-profile            business accounts only: company, tax id, industry and the verification status
//   PUT    /b2b-profile            business accounts only: the company, tax id and industry. The verification status is not part of it
// /api/staff
//   PATCH  /b2b-profiles/:userId   the staff key or an admin: { verificationStatus: "pending" | "verified" | "rejected" }
import { ipKeyGenerator } from "express-rate-limit";
import { Router, type RequestHandler } from "express";
import { env } from "../config/env.ts";
import { createUsersController } from "../controllers/users.controller.ts";
import { createAuthController } from "../controllers/auth.controller.ts";
import { requireAccountType, requireAuth, requireStaff } from "../middleware/auth.ts";
import { createRateLimiter } from "../middleware/rateLimit.ts";
import { noStore } from "../middleware/security.ts";
import { createAccountService, type AccountService } from "../services/account.service.ts";
import { createMongoAddressStore } from "../services/address.store.ts";
import { createMongoB2BProfileStore } from "../services/b2b-profile.store.ts";
import { createMongoUserStore } from "../services/user.store.ts";
import { authService } from "./auth.routes.ts";

export function createUsersRouter({ service, passwordLimiter, secureCookie = env.COOKIE_SECURE }: { service: AccountService; passwordLimiter: RequestHandler; secureCookie?: boolean }) {
  // the answer of a password change carries a new sign in, in the same form as the sign in routes
  const sessionAnswer = createAuthController(authService, { secure: secureCookie, accessTokenMinutes: env.ACCESS_TOKEN_MINUTES });
  const controller = createUsersController(service, sessionAnswer);
  const router = Router();

  router.use(noStore, requireAuth);

  router.get("/", controller.me);
  router.patch("/", controller.updateProfile);
  router.patch("/password", passwordLimiter, controller.changePassword);

  router.get("/addresses", controller.listAddresses);
  router.post("/addresses", controller.createAddress);
  router.patch("/addresses/:id", controller.updateAddress);
  router.delete("/addresses/:id", controller.deleteAddress);
  router.post("/addresses/:id/default", controller.setDefaultAddress);

  router.get("/b2b-profile", requireAccountType("b2b"), controller.getBusinessProfile);
  router.put("/b2b-profile", requireAccountType("b2b"), controller.saveBusinessProfile);

  return router;
}

export function createStaffRouter({ service }: { service: AccountService }) {
  const controller = createUsersController(service, { setRefreshCookie() {}, sessionBody: () => ({}) });
  const router = Router();

  router.use(noStore, requireStaff);
  router.patch("/b2b-profiles/:userId", controller.setVerification);

  return router;
}

// wrong current passwords are counted for each user, so a stolen access token cannot be used to guess the password
export const passwordChangeLimiter = (options: { limit?: number; windowMs?: number } = {}) =>
  createRateLimiter({
    limit: options.limit ?? 5,
    windowMs: options.windowMs ?? 15 * 60 * 1000,
    message: "Too many wrong passwords. Please wait a few minutes and try again.",
    keyBy: (req) => (req.user ? `user:${req.user.id}` : ipKeyGenerator(req.ip ?? "")),
    onlyFailures: true,
  });

export const accountService = createAccountService({
  users: createMongoUserStore(),
  profiles: createMongoB2BProfileStore(),
  addresses: createMongoAddressStore(),
  auth: authService,
});

export const usersRouter = createUsersRouter({ service: accountService, passwordLimiter: passwordChangeLimiter() });
export const staffRouter = createStaffRouter({ service: accountService });
