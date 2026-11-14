import { jwtVerify } from "jose";
import { describe, expect, it, vi } from "vitest";
import { env } from "../config/env.ts";
import { createMemoryB2BProfileStore } from "../test/memoryB2BProfileStore.ts";
import { createMemorySessionStore } from "../test/memorySessionStore.ts";
import { createMemoryUserStore } from "../test/memoryUserStore.ts";
import { createAuthService, hashToken, type AuthSettings } from "./auth.service.ts";
import { createHasher } from "./password.ts";

const settings: AuthSettings = {
  accessTokenMinutes: 15,
  refreshTokenDays: 7,
  maxFailedLogins: 3,
  lockMinutes: 15,
  resetTokenMinutes: 60,
  reuseGraceSeconds: 10,
  siteUrl: "https://shop.example/",
};

const minute = 60_000;

// the token in the link of the n-th reset email
function tokenSent(mail: { sendPasswordReset: { mock: { calls: unknown[][] } } }, index = 0): string {
  return new URL(mail.sendPasswordReset.mock.calls[index][1] as string).searchParams.get("token")!;
}
const day = 24 * 60 * minute;
const signUp = { name: "Isabel Vasquez", email: "isabel@example.com", password: "correct horse 42", accountType: "retail" as const, preferredLanguage: "en" as const };

function setup() {
  const users = createMemoryUserStore();
  const sessions = createMemorySessionStore();
  const profiles = createMemoryB2BProfileStore();
  const mail = { sendPasswordReset: vi.fn(async (_user: { email: string; name?: string }, _link: string, _lang: string) => true) };
  const hasher = createHasher(4);
  let current = new Date("2026-03-01T12:00:00.000Z");
  const service = createAuthService({ users, sessions, profiles, mail, hasher, settings, now: () => current });

  return {
    users,
    sessions,
    profiles,
    mail,
    hasher,
    service,
    wait: (ms: number) => void (current = new Date(current.getTime() + ms)),
    now: () => current,
  };
}

describe("register", () => {
  it("makes the account and signs it in with an access token and a refresh token", async () => {
    const { service, users } = setup();

    const session = await service.register(signUp);

    expect(session.user).toMatchObject({ email: "isabel@example.com", name: "Isabel Vasquez", role: "user", accountType: "retail" });
    expect(users.all()).toHaveLength(1);
    expect(session.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const { payload } = await jwtVerify(session.accessToken, new TextEncoder().encode(env.JWT_SECRET));
    expect(payload).toMatchObject({ sub: session.user.id, role: "user", accountType: "retail" });
    expect(payload.exp! - payload.iat!).toBe(15 * 60);
  });

  it("keeps the password only as a bcrypt hash", async () => {
    const { service, users } = setup();

    const { user } = await service.register(signUp);
    const stored = await users.findCredentialsById(user.id);

    expect(stored?.passwordHash).toMatch(/^\$2[aby]\$04\$/);
    expect(stored?.passwordHash).not.toContain("correct horse");
  });

  it("keeps only the hash of the refresh token, and lets it work for the days that were set", async () => {
    const { service, sessions, now } = setup();

    const session = await service.register(signUp);
    const [saved] = sessions.all();

    expect(saved.tokenHash).toBe(hashToken(session.refreshToken));
    expect(JSON.stringify(saved)).not.toContain(session.refreshToken);
    expect(saved.expiresAt.getTime()).toBe(now().getTime() + 7 * day);
    expect(session.refreshExpiresAt).toEqual(saved.expiresAt);
  });

  it("makes the business details too for a business account, waiting for verification", async () => {
    const { service, profiles } = setup();

    const { user } = await service.register({ ...signUp, accountType: "b2b", companyName: "Hacienda Brands" });

    expect(user.accountType).toBe("b2b");
    expect(await profiles.findByUserId(user.id)).toMatchObject({ companyName: "Hacienda Brands", verificationStatus: "pending" });
  });

  it("does not keep a business account whose business details could not be saved", async () => {
    const { service, users, profiles } = setup();
    profiles.save = async () => Promise.reject(new Error("the database stopped"));

    await expect(service.register({ ...signUp, accountType: "b2b", companyName: "Hacienda Brands" })).rejects.toThrow("the database stopped");

    expect(users.all()).toHaveLength(0);
  });

  it("refuses an email that already has an account, whatever the case", async () => {
    const { service } = setup();
    await service.register(signUp);

    await expect(service.register({ ...signUp, email: "ISABEL@example.com" })).rejects.toMatchObject({ status: 409, code: "EMAIL_TAKEN" });
  });
});

describe("login", () => {
  it("signs in with the right password, and gives a new pair of tokens each time", async () => {
    const { service } = setup();
    await service.register(signUp);

    const first = await service.login({ email: "isabel@example.com", password: signUp.password });
    const second = await service.login({ email: "isabel@example.com", password: signUp.password });

    expect(first.user.email).toBe("isabel@example.com");
    expect(first.refreshToken).not.toBe(second.refreshToken);
  });

  it("answers a wrong password and an unknown email in exactly the same way", async () => {
    const { service } = setup();
    await service.register(signUp);

    const wrongPassword = await service.login({ email: "isabel@example.com", password: "not the one 99" }).catch((error) => error);
    const unknownEmail = await service.login({ email: "nobody@example.com", password: "not the one 99" }).catch((error) => error);

    expect(wrongPassword).toMatchObject({ status: 401, code: "INVALID_CREDENTIALS" });
    expect(unknownEmail).toMatchObject({ status: 401, code: "INVALID_CREDENTIALS" });
    expect(unknownEmail.message).toBe(wrongPassword.message);
    expect(unknownEmail.details).toEqual(wrongPassword.details);
  });

  it("still does the slow part of the check for an unknown email, so the answer is not faster", async () => {
    const { service, hasher } = setup();
    const decoy = vi.spyOn(hasher, "verifyNothing");

    await service.login({ email: "nobody@example.com", password: "whatever 12" }).catch(() => {});

    expect(decoy).toHaveBeenCalledTimes(1);
  });

  it("locks the account after too many wrong passwords in a row, even for the right password", async () => {
    const { service } = setup();
    await service.register(signUp);

    for (let attempt = 0; attempt < 3; attempt++) {
      await expect(service.login({ email: "isabel@example.com", password: "wrong 12345" })).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    }

    await expect(service.login({ email: "isabel@example.com", password: signUp.password })).rejects.toMatchObject({ status: 429, code: "TOO_MANY_ATTEMPTS" });
  });

  it("lets the person in again when the lock is over", async () => {
    const { service, wait } = setup();
    await service.register(signUp);
    for (let attempt = 0; attempt < 3; attempt++) await service.login({ email: "isabel@example.com", password: "wrong 12345" }).catch(() => {});

    wait(15 * minute + 1000);

    await expect(service.login({ email: "isabel@example.com", password: signUp.password })).resolves.toMatchObject({ user: { email: "isabel@example.com" } });
  });

  it("starts the count of wrong passwords again after a good sign in", async () => {
    const { service } = setup();
    await service.register(signUp);
    const wrong = () => service.login({ email: "isabel@example.com", password: "wrong 12345" }).catch(() => {});

    await wrong();
    await wrong();
    await service.login({ email: "isabel@example.com", password: signUp.password });
    await wrong();
    await wrong();

    // two and two, never three in a row
    await expect(service.login({ email: "isabel@example.com", password: signUp.password })).resolves.toBeDefined();
  });

  it("does not count the wrong passwords during a lock, so a lock cannot be made longer by trying", async () => {
    const { service, wait } = setup();
    await service.register(signUp);
    for (let attempt = 0; attempt < 3; attempt++) await service.login({ email: "isabel@example.com", password: "wrong 12345" }).catch(() => {});

    for (let attempt = 0; attempt < 10; attempt++) await service.login({ email: "isabel@example.com", password: "wrong 12345" }).catch(() => {});
    wait(15 * minute + 1000);

    await expect(service.login({ email: "isabel@example.com", password: signUp.password })).resolves.toBeDefined();
  });
});

describe("refresh", () => {
  it("swaps the refresh token for a new pair, in the same sign in", async () => {
    const { service, sessions } = setup();
    const first = await service.register(signUp);

    const second = await service.refresh(first.refreshToken);

    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(second.user.id).toBe(first.user.id);
    expect(new Set(sessions.all().map((saved) => saved.family)).size).toBe(1);
  });

  it("works once: the old token is no good after it was used", async () => {
    const { service, wait } = setup();
    const first = await service.register(signUp);
    await service.refresh(first.refreshToken);
    wait(60_000);

    await expect(service.refresh(first.refreshToken)).rejects.toMatchObject({ status: 401, code: "SESSION_EXPIRED" });
  });

  it("ends the whole sign in when an old token comes back later, because somebody has a copy", async () => {
    const { service, wait } = setup();
    const first = await service.register(signUp);
    const second = await service.refresh(first.refreshToken);
    wait(60_000);

    await expect(service.refresh(first.refreshToken)).rejects.toMatchObject({ code: "SESSION_EXPIRED" });

    // the newest token belongs to the same sign in, so it is gone too
    await expect(service.refresh(second.refreshToken)).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
  });

  it("does not end the sign in when a second tab asks with the same token a moment later", async () => {
    const { service, wait } = setup();
    const first = await service.register(signUp);
    const second = await service.refresh(first.refreshToken);
    wait(2000);

    await expect(service.refresh(first.refreshToken)).rejects.toMatchObject({ code: "SESSION_EXPIRED" });

    await expect(service.refresh(second.refreshToken)).resolves.toBeDefined();
  });

  it("does not touch the sign ins of other devices when one is ended", async () => {
    const { service, wait } = setup();
    const phone = await service.register(signUp);
    const laptop = await service.login({ email: "isabel@example.com", password: signUp.password });
    await service.refresh(phone.refreshToken);
    wait(60_000);
    await service.refresh(phone.refreshToken).catch(() => {});

    await expect(service.refresh(laptop.refreshToken)).resolves.toBeDefined();
  });

  it("refuses no token, a token nobody made, and a token that ran out", async () => {
    const { service, wait } = setup();
    const first = await service.register(signUp);

    await expect(service.refresh(undefined)).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
    await expect(service.refresh("A".repeat(43))).rejects.toMatchObject({ code: "SESSION_EXPIRED" });

    wait(7 * day + 1000);
    await expect(service.refresh(first.refreshToken)).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
  });

  it("refuses a token of an account that was closed, and ends its sign in", async () => {
    const { service, users } = setup();
    const first = await service.register(signUp);
    await users.remove(first.user.id);

    await expect(service.refresh(first.refreshToken)).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
  });

  it("gives the access token the role and account type the account has now", async () => {
    const { service } = setup();
    const first = await service.register({ ...signUp, accountType: "b2b", companyName: "Hacienda Brands" });

    const second = await service.refresh(first.refreshToken);
    const { payload } = await jwtVerify(second.accessToken, new TextEncoder().encode(env.JWT_SECRET));

    expect(payload).toMatchObject({ accountType: "b2b", role: "user" });
  });
});

describe("logout", () => {
  it("ends the sign in, so its refresh token does not work any more", async () => {
    const { service } = setup();
    const first = await service.register(signUp);

    await service.logout(first.refreshToken);

    await expect(service.refresh(first.refreshToken)).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
  });

  it("ends only the sign in of this device", async () => {
    const { service } = setup();
    const phone = await service.register(signUp);
    const laptop = await service.login({ email: "isabel@example.com", password: signUp.password });

    await service.logout(phone.refreshToken);

    await expect(service.refresh(laptop.refreshToken)).resolves.toBeDefined();
  });

  it("is fine with no token or an unknown token", async () => {
    const { service } = setup();

    await expect(service.logout(undefined)).resolves.toBeUndefined();
    await expect(service.logout("nothing")).resolves.toBeUndefined();
  });
});

describe("forgotPassword", () => {
  it("sends the link in the language of the account, to the address of the account", async () => {
    const { service, mail } = setup();
    await service.register({ ...signUp, preferredLanguage: "es" });

    await service.forgotPassword("isabel@example.com");

    expect(mail.sendPasswordReset).toHaveBeenCalledTimes(1);
    const [recipient, link, lang] = mail.sendPasswordReset.mock.calls[0];
    expect(recipient).toEqual({ email: "isabel@example.com", name: "Isabel Vasquez" });
    expect(lang).toBe("es");
    expect(link).toMatch(/^https:\/\/shop\.example\/es\/account\/reset-password\?token=[A-Za-z0-9_-]{43}$/);
  });

  it("does nothing, and says nothing, for an address without an account", async () => {
    const { service, mail } = setup();

    await expect(service.forgotPassword("nobody@example.com")).resolves.toBeUndefined();

    expect(mail.sendPasswordReset).not.toHaveBeenCalled();
  });

  it("keeps only the hash of the token, never the token", async () => {
    const { service, mail, users } = setup();
    const { user } = await service.register(signUp);
    await service.forgotPassword("isabel@example.com");
    const token = tokenSent(mail);

    expect(await users.consumeResetToken(token, new Date(0))).toBeNull();
    expect(await users.consumeResetToken(hashToken(token), new Date(0))).toMatchObject({ id: user.id });
  });

  it("does not wait for, or fail because of, the mail server", async () => {
    const { service, mail } = setup();
    await service.register(signUp);
    mail.sendPasswordReset.mockImplementation(() => Promise.reject(new Error("the mail server is down")));

    await expect(service.forgotPassword("isabel@example.com")).resolves.toBeUndefined();
  });
});

describe("resetPassword", () => {
  async function withLink() {
    const context = setup();
    const first = await context.service.register(signUp);
    await context.service.forgotPassword("isabel@example.com");
    return { ...context, first, token: tokenSent(context.mail) };
  }

  it("sets the new password: the new one works and the old one does not", async () => {
    const { service, token } = await withLink();

    await service.resetPassword(token, "brand new pass 7");

    await expect(service.login({ email: "isabel@example.com", password: "brand new pass 7" })).resolves.toBeDefined();
    await expect(service.login({ email: "isabel@example.com", password: signUp.password })).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("ends every sign in of the account", async () => {
    const { service, token, first } = await withLink();

    await service.resetPassword(token, "brand new pass 7");

    await expect(service.refresh(first.refreshToken)).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
  });

  it("works once", async () => {
    const { service, token } = await withLink();
    await service.resetPassword(token, "brand new pass 7");

    await expect(service.resetPassword(token, "another pass 8888")).rejects.toMatchObject({ status: 400, code: "RESET_LINK_INVALID" });
  });

  it("stops working after an hour", async () => {
    const { service, token, wait } = await withLink();

    wait(61 * minute);

    await expect(service.resetPassword(token, "brand new pass 7")).rejects.toMatchObject({ code: "RESET_LINK_INVALID" });
  });

  it("refuses a token nobody made, with the same answer as an old one", async () => {
    const { service } = await withLink();

    await expect(service.resetPassword("B".repeat(43), "brand new pass 7")).rejects.toMatchObject({ status: 400, code: "RESET_LINK_INVALID" });
  });

  it("lets a locked account in again, because choosing a new password ends the lock", async () => {
    const { service, token } = await withLink();
    for (let attempt = 0; attempt < 3; attempt++) await service.login({ email: "isabel@example.com", password: "wrong 12345" }).catch(() => {});

    await service.resetPassword(token, "brand new pass 7");

    await expect(service.login({ email: "isabel@example.com", password: "brand new pass 7" })).resolves.toBeDefined();
  });

  it("only the newest link works when two were asked for", async () => {
    const { service, mail } = await withLink();
    const firstToken = tokenSent(mail, 0);
    await service.forgotPassword("isabel@example.com");
    const secondToken = tokenSent(mail, 1);

    await expect(service.resetPassword(firstToken, "brand new pass 7")).rejects.toMatchObject({ code: "RESET_LINK_INVALID" });
    await expect(service.resetPassword(secondToken, "brand new pass 7")).resolves.toBeUndefined();
  });
});

describe("changePassword", () => {
  it("checks the current password, sets the new one and gives this device a fresh sign in", async () => {
    const { service } = setup();
    const first = await service.register(signUp);

    const fresh = await service.changePassword(first.user.id, signUp.password, "brand new pass 7");

    expect(fresh.refreshToken).not.toBe(first.refreshToken);
    await expect(service.login({ email: "isabel@example.com", password: "brand new pass 7" })).resolves.toBeDefined();
    await expect(service.login({ email: "isabel@example.com", password: signUp.password })).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("ends the other sign ins, but not the new one", async () => {
    const { service } = setup();
    const first = await service.register(signUp);
    const otherDevice = await service.login({ email: "isabel@example.com", password: signUp.password });

    const fresh = await service.changePassword(first.user.id, signUp.password, "brand new pass 7");

    await expect(service.refresh(first.refreshToken)).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
    await expect(service.refresh(otherDevice.refreshToken)).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
    await expect(service.refresh(fresh.refreshToken)).resolves.toBeDefined();
  });

  it("refuses a wrong current password, naming the field, and changes nothing", async () => {
    const { service } = setup();
    const first = await service.register(signUp);

    await expect(service.changePassword(first.user.id, "not the one 99", "brand new pass 7")).rejects.toMatchObject({
      status: 400,
      code: "WRONG_PASSWORD",
      details: [{ field: "currentPassword", message: expect.any(String) }],
    });
    await expect(service.login({ email: "isabel@example.com", password: signUp.password })).resolves.toBeDefined();
    await expect(service.refresh(first.refreshToken)).resolves.toBeDefined();
  });

  it("refuses an account that is not there", async () => {
    const { service } = setup();

    await expect(service.changePassword("64b7f0c2a1b2c3d4e5f607ff", "x", "y")).rejects.toMatchObject({ status: 401 });
  });
});
