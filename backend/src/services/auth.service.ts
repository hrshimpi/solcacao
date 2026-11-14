// Signing up, signing in and keeping people signed in. A sign in gives two tokens:
//   the access token   a short lived JWT that is sent with every request (see middleware/auth.ts)
//   the refresh token  a long lived random text that only goes in an httpOnly cookie, and is used once to get
//                      the next pair. Only its hash is kept, so a copy of the database cannot be used to sign in.
// A wrong password and an unknown email give the same answer, and take about the same time.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { AppError } from "../errors/AppError.ts";
import { signToken } from "../middleware/auth.ts";
import type { RegisterInput } from "../schemas/auth.schema.ts";
import type { B2BProfileStore } from "./b2b-profile.store.ts";
import { inTheBackground } from "./background.ts";
import type { Hasher } from "./password.ts";
import type { SessionStore } from "./session.store.ts";
import type { StoredUser, UserStore } from "./user.store.ts";

export interface AuthSettings {
  accessTokenMinutes: number;
  refreshTokenDays: number;
  // this many wrong passwords in a row lock the account for lockMinutes
  maxFailedLogins: number;
  lockMinutes: number;
  resetTokenMinutes: number;
  // a refresh token that was used a moment ago is not a theft, two tabs can ask at the same time
  reuseGraceSeconds: number;
  // the address of the website, for the link in the reset email
  siteUrl: string;
}

export interface AuthMail {
  sendPasswordReset(user: { email: string; name?: string }, link: string, lang: string): Promise<boolean>;
}

export interface AuthSession {
  user: StoredUser;
  accessToken: string;
  // goes in the cookie, never in the body of an answer
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface AuthServiceDeps {
  users: UserStore;
  sessions: SessionStore;
  profiles: B2BProfileStore;
  mail: AuthMail;
  hasher: Hasher;
  settings: AuthSettings;
  now?: () => Date;
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");

const minute = 60_000;
const day = 24 * 60 * minute;

const wrongCredentials = () => new AppError("INVALID_CREDENTIALS", 401, "That email and password don't match an account.");
const sessionEnded = () => new AppError("SESSION_EXPIRED", 401, "Your session ended. Please sign in again.");
const badResetLink = () => new AppError("RESET_LINK_INVALID", 400, "This reset link is not valid, or it has expired. Please ask for a new one.");

export function createAuthService({ users, sessions, profiles, mail, hasher, settings, now = () => new Date() }: AuthServiceDeps) {
  // gives a user a pair of tokens. A new sign in starts a new family, a refresh stays in the family it came from.
  async function startSession(user: StoredUser, family: string = randomUUID()): Promise<AuthSession> {
    const refreshToken = newToken();
    const refreshExpiresAt = new Date(now().getTime() + settings.refreshTokenDays * day);

    await sessions.create({ userId: user.id, tokenHash: hashToken(refreshToken), family, expiresAt: refreshExpiresAt });
    const accessToken = await signToken({ id: user.id, role: user.role, accountType: user.accountType }, `${settings.accessTokenMinutes}m`);

    return { user, accessToken, refreshToken, refreshExpiresAt };
  }

  return {
    startSession,

    async register(input: RegisterInput): Promise<AuthSession> {
      const passwordHash = await hasher.hash(input.password);
      const user = await users.create({
        email: input.email,
        name: input.name,
        passwordHash,
        accountType: input.accountType,
        preferredLanguage: input.preferredLanguage,
      });

      if (input.accountType === "b2b" && input.companyName !== undefined) {
        try {
          await profiles.save(user.id, { companyName: input.companyName });
        } catch (error) {
          // a business account without its business details would be half made, so it is not kept
          await users.remove(user.id);
          throw error;
        }
      }

      return startSession(user);
    },

    async login(input: { email: string; password: string }): Promise<AuthSession> {
      const credentials = await users.findCredentials(input.email);
      if (!credentials) {
        await hasher.verifyNothing(input.password);
        throw wrongCredentials();
      }

      const { user, passwordHash, lockedUntil } = credentials;
      if (lockedUntil && lockedUntil > now()) {
        throw new AppError("TOO_MANY_ATTEMPTS", 429, `Too many wrong passwords. Please try again in ${settings.lockMinutes} minutes, or reset your password.`);
      }

      if (!(await hasher.verify(input.password, passwordHash))) {
        await users.recordFailedLogin(user.id, { maxFailures: settings.maxFailedLogins, lockMs: settings.lockMinutes * minute, now: now() });
        throw wrongCredentials();
      }

      await users.recordLogin(user.id, now());
      return startSession(user);
    },

    // swaps the refresh token for a new pair. A token works once: showing an old one again means somebody has a copy.
    async refresh(token: string | undefined): Promise<AuthSession> {
      if (!token) throw sessionEnded();

      const used = await sessions.consume(hashToken(token), now());
      if (used.status === "unknown") throw sessionEnded();

      if (used.status === "reused") {
        const justNow = now().getTime() - used.usedAt.getTime() < settings.reuseGraceSeconds * 1000;
        // a second tab that asked at the same moment is told to try again, a real copy ends the whole sign in
        if (!justNow) await sessions.revokeFamily(used.family, now());
        throw sessionEnded();
      }

      const user = await users.findById(used.userId);
      if (!user) {
        await sessions.revokeFamily(used.family, now());
        throw sessionEnded();
      }
      return startSession(user, used.family);
    },

    // a sign out ends the sign in on this device only
    async logout(token: string | undefined): Promise<void> {
      if (token) await sessions.revokeByToken(hashToken(token), now());
    },

    // answers the same whether the address has an account or not, so it cannot be used to find out who has one
    async forgotPassword(email: string): Promise<void> {
      const found = await users.findCredentials(email);
      if (!found) return;

      const token = newToken();
      await users.setResetToken(found.user.id, hashToken(token), new Date(now().getTime() + settings.resetTokenMinutes * minute));

      const lang = found.user.preferredLanguage;
      const link = `${settings.siteUrl.replace(/\/+$/, "")}/${lang}/account/reset-password?token=${token}`;
      // the person gets their answer without waiting for the mail server
      inTheBackground(() => mail.sendPasswordReset({ email: found.user.email, name: found.user.name }, link, lang));
    },

    // the token is taken out in the same step that finds it, so a link works once. Every sign in of the account ends.
    async resetPassword(token: string, password: string): Promise<void> {
      const user = await users.consumeResetToken(hashToken(token), now());
      if (!user) throw badResetLink();

      await users.setPassword(user.id, await hasher.hash(password), now());
      await sessions.revokeUser(user.id, now());
    },

    // for the account area: checks the current password, sets the new one, ends every sign in and starts a new one
    // for this device, so the person is not signed out of the device they are using
    async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<AuthSession> {
      const credentials = await users.findCredentialsById(userId);
      if (!credentials) throw new AppError("UNAUTHENTICATED", 401, "Please sign in again to do that.");

      if (!(await hasher.verify(currentPassword, credentials.passwordHash))) {
        throw new AppError("WRONG_PASSWORD", 400, "Your current password isn't right.", [{ field: "currentPassword", message: "Your current password isn't right." }]);
      }

      await users.setPassword(userId, await hasher.hash(newPassword), now());
      await sessions.revokeUser(userId, now());
      return startSession(credentials.user);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
