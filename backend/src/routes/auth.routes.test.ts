import cookieParser from "cookie-parser";
import express from "express";
import { pino } from "pino";
import { pinoHttp } from "pino-http";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { requireAuth } from "../middleware/auth.ts";
import { errorHandler } from "../middleware/errorHandler.ts";
import { createAuthService } from "../services/auth.service.ts";
import { createHasher } from "../services/password.ts";
import { createMemoryB2BProfileStore } from "../test/memoryB2BProfileStore.ts";
import { createMemorySessionStore } from "../test/memorySessionStore.ts";
import { createMemoryUserStore } from "../test/memoryUserStore.ts";
import { authLimiters, createAuthRouter } from "./auth.routes.ts";

const signUp = { name: "Isabel Vasquez", email: "isabel@example.com", password: "correct horse 42" };

function build(options: { loginLimit?: number; secureCookie?: boolean } = {}) {
  const users = createMemoryUserStore();
  const sessions = createMemorySessionStore();
  const profiles = createMemoryB2BProfileStore();
  const mail = { sendPasswordReset: vi.fn(async (_user: { email: string; name?: string }, _link: string, _lang: string) => true) };
  const service = createAuthService({
    users,
    sessions,
    profiles,
    mail,
    hasher: createHasher(4),
    settings: { accessTokenMinutes: 15, refreshTokenDays: 7, maxFailedLogins: 5, lockMinutes: 15, resetTokenMinutes: 60, reuseGraceSeconds: 10, siteUrl: "https://shop.example" },
  });

  const app = express();
  app.use(pinoHttp({ logger: pino({ level: "silent" }) }));
  app.use(cookieParser());
  app.use(express.json({ limit: "100kb" }));
  app.use("/api/auth", createAuthRouter({ service, limiters: authLimiters({ loginLimit: options.loginLimit }), secureCookie: options.secureCookie ?? false }));
  app.get("/api/whoami", requireAuth, (req, res) => void res.json({ user: req.user }));
  app.use(errorHandler);

  return { app, users, sessions, profiles, mail };
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const cookieLine = (res: request.Response) => ((res.headers["set-cookie"] as unknown as string[] | undefined) ?? []).find((line) => line.startsWith("sc_refresh="));
const tokenIn = (line: string | undefined) => line?.split(";")[0].slice("sc_refresh=".length) ?? "";

describe("POST /api/auth/register", () => {
  it("creates the account and answers 201 with the user and an access token that works", async () => {
    const { app } = build();

    const res = await request(app).post("/api/auth/register").send(signUp);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: "isabel@example.com", name: "Isabel Vasquez", role: "user", accountType: "retail", preferredLanguage: "en" });
    expect(res.body.expiresIn).toBe(15 * 60);

    const me = await request(app).get("/api/whoami").set(bearer(res.body.accessToken));
    expect(me.body.user).toMatchObject({ id: res.body.user.id, role: "user", accountType: "retail" });
  });

  it("puts the refresh token in a cookie that scripts cannot read, only our site gets, and only the auth routes see", async () => {
    const { app } = build();

    const res = await request(app).post("/api/auth/register").send(signUp);
    const line = cookieLine(res);

    expect(line).toBeDefined();
    expect(line).toMatch(/HttpOnly/i);
    expect(line).toMatch(/SameSite=Strict/i);
    expect(line).toMatch(/Path=\/api\/auth(;|$)/);
    expect(line).toMatch(/Expires=/i);
    expect(line).not.toMatch(/Secure/i);
  });

  it("makes the cookie https only in production", async () => {
    const { app } = build({ secureCookie: true });

    const res = await request(app).post("/api/auth/register").send(signUp);

    expect(cookieLine(res)).toMatch(/; Secure/i);
  });

  it("never puts the refresh token, the password or the hash in the body of the answer", async () => {
    const { app } = build();

    const res = await request(app).post("/api/auth/register").send(signUp);
    const text = JSON.stringify(res.body);

    expect(text).not.toContain(tokenIn(cookieLine(res)));
    expect(text).not.toContain("correct horse");
    expect(text).not.toMatch(/passwordHash|\$2[aby]\$|refreshToken|failedLogins/);
  });

  it("makes a business account with its company when asked for one", async () => {
    const { app, profiles } = build();

    const res = await request(app).post("/api/auth/register").send({ ...signUp, accountType: "b2b", companyName: "Hacienda Brands" });

    expect(res.status).toBe(201);
    expect(res.body.user.accountType).toBe("b2b");
    expect(await profiles.findByUserId(res.body.user.id)).toMatchObject({ companyName: "Hacienda Brands", verificationStatus: "pending" });
  });

  it("does not let a person name their own role: only the fields of the form are read", async () => {
    const { app, users } = build();

    const res = await request(app).post("/api/auth/register").send({ ...signUp, role: "admin", isAdmin: true, emailVerified: true, failedLogins: -5, id: "64b7f0c2a1b2c3d4e5f607ff" });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("user");
    expect(res.body.user.id).not.toBe("64b7f0c2a1b2c3d4e5f607ff");
    expect(users.all()[0].role).toBe("user");
  });

  it("keeps the email in lower case, so the same person cannot make two accounts by changing the case", async () => {
    const { app } = build();
    await request(app).post("/api/auth/register").send({ ...signUp, email: "Isabel@Example.com" });

    const again = await request(app).post("/api/auth/register").send(signUp);

    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("strips tags from the name", async () => {
    const { app } = build();

    const res = await request(app).post("/api/auth/register").send({ ...signUp, name: "<script>alert(1)</script>Isabel <b>V</b>" });

    expect(res.status).toBe(201);
    expect(res.body.user.name).toBe("Isabel V");
  });

  it("answers 400 with the field of each problem, in words a person can read", async () => {
    const { app } = build();

    const res = await request(app).post("/api/auth/register").send({ name: "", email: "not an email", password: "short" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.map((detail: { field: string }) => detail.field).sort()).toEqual(["email", "name", "password"]);
    expect(res.body.error.message).toEqual(expect.any(String));
  });

  it.each([
    ["is too short", "abc123"],
    ["has no number", "only letters here"],
    ["has no letter", "1234567890"],
    ["is too easy to guess", "password123"],
    ["is longer than bcrypt reads", `a1${"x".repeat(80)}`],
    ["is not text", 1234567890],
  ])("refuses a password that %s", async (_why, password) => {
    const { app } = build();

    const res = await request(app).post("/api/auth/register").send({ ...signUp, password });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe("password");
  });

  it("takes a password exactly as typed, spaces and all", async () => {
    const { app } = build();

    await request(app).post("/api/auth/register").send({ ...signUp, password: "  spaces count 1  " });

    expect((await request(app).post("/api/auth/login").send({ email: signUp.email, password: "  spaces count 1  " })).status).toBe(200);
    expect((await request(app).post("/api/auth/login").send({ email: signUp.email, password: "spaces count 1" })).status).toBe(401);
  });

  it("asks a business account for its company", async () => {
    const { app, users } = build();

    const res = await request(app).post("/api/auth/register").send({ ...signUp, accountType: "b2b" });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: "companyName", message: "Please enter your company name." }]);
    expect(users.all()).toHaveLength(0);
  });

  it("refuses an account type that does not exist", async () => {
    const { app } = build();

    const res = await request(app).post("/api/auth/register").send({ ...signUp, accountType: "admin" });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe("accountType");
  });

  it("refuses a body that is not an object, or no body at all", async () => {
    const { app } = build();

    for (const body of [[], "text", 5, null]) {
      const res = await request(app).post("/api/auth/register").set("Content-Type", "application/json").send(JSON.stringify(body));
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect((await request(app).post("/api/auth/register")).status).toBe(400);
  });

  it("answers 409 for an email that has an account", async () => {
    const { app } = build();
    await request(app).post("/api/auth/register").send(signUp);

    const res = await request(app).post("/api/auth/register").send(signUp);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: "EMAIL_TAKEN", details: [] });
  });

  it("limits how many accounts one address can make in an hour", async () => {
    const { app } = build();

    const answers = [];
    for (let index = 0; index < 6; index++) {
      answers.push((await request(app).post("/api/auth/register").send({ ...signUp, email: `person${index}@example.com` })).status);
    }

    expect(answers).toEqual([201, 201, 201, 201, 201, 429]);
  });
});

describe("POST /api/auth/login", () => {
  it("signs in and sets the cookie", async () => {
    const { app } = build();
    await request(app).post("/api/auth/register").send(signUp);

    const res = await request(app).post("/api/auth/login").send({ email: "ISABEL@example.com", password: signUp.password });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("isabel@example.com");
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(cookieLine(res)).toMatch(/HttpOnly/i);
  });

  it("answers a wrong password and an unknown email with the same status, code and words", async () => {
    const { app } = build();
    await request(app).post("/api/auth/register").send(signUp);

    const wrong = await request(app).post("/api/auth/login").send({ email: signUp.email, password: "not the one 99" });
    const unknown = await request(app).post("/api/auth/login").send({ email: "nobody@example.com", password: "not the one 99" });

    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
    expect(wrong.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(cookieLine(wrong)).toBeUndefined();
  });

  it("does not let a query operator take the place of the email or the password", async () => {
    const { app } = build();
    await request(app).post("/api/auth/register").send(signUp);

    for (const body of [
      { email: { $ne: null }, password: { $ne: null } },
      { email: signUp.email, password: { $ne: "" } },
      { email: { $regex: ".*" }, password: signUp.password },
      { email: [signUp.email], password: signUp.password },
    ]) {
      const res = await request(app).post("/api/auth/login").send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(cookieLine(res)).toBeUndefined();
    }
  });

  it("asks for both fields", async () => {
    const { app } = build();

    const res = await request(app).post("/api/auth/login").send({});

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((detail: { field: string }) => detail.field).sort()).toEqual(["email", "password"]);
  });

  it("locks the account for a while after five wrong passwords, and says so", async () => {
    const { app } = build({ loginLimit: 50 });
    await request(app).post("/api/auth/register").send(signUp);

    for (let attempt = 0; attempt < 5; attempt++) {
      await request(app).post("/api/auth/login").send({ email: signUp.email, password: "wrong 12345" });
    }
    const res = await request(app).post("/api/auth/login").send({ email: signUp.email, password: signUp.password });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("TOO_MANY_ATTEMPTS");
  });

  it("stops an address that keeps failing, and does not count the ones that went right", async () => {
    const { app } = build({ loginLimit: 3 });
    await request(app).post("/api/auth/register").send(signUp);

    for (let attempt = 0; attempt < 6; attempt++) {
      expect((await request(app).post("/api/auth/login").send({ email: signUp.email, password: signUp.password })).status).toBe(200);
    }
    const failures = [];
    for (let attempt = 0; attempt < 5; attempt++) {
      failures.push((await request(app).post("/api/auth/login").send({ email: `nobody${attempt}@example.com`, password: "wrong 12345" })).status);
    }

    expect(failures).toEqual([401, 401, 401, 429, 429]);
  });
});

describe("POST /api/auth/refresh", () => {
  it("gives a new access token and a new cookie, and the old cookie works only once", async () => {
    const { app } = build();
    const first = await request(app).post("/api/auth/register").send(signUp);
    const oldCookie = cookieLine(first)!.split(";")[0];

    const res = await request(app).post("/api/auth/refresh").set("Cookie", oldCookie);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(first.body.user.id);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(tokenIn(cookieLine(res))).not.toBe(tokenIn(oldCookie));

    // a moment later the old one is shown again: that is refused, and the cookie is taken away
    const again = await request(app).post("/api/auth/refresh").set("Cookie", oldCookie);
    expect(again.status).toBe(401);
    expect(again.body.error.code).toBe("SESSION_EXPIRED");
    expect(cookieLine(again)).toMatch(/sc_refresh=;/);
  });

  it("answers 401 without a cookie, and clears none that is not there", async () => {
    const { app } = build();

    const res = await request(app).post("/api/auth/refresh");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("SESSION_EXPIRED");
  });

  it("answers 401 for a cookie nobody made", async () => {
    const { app } = build();

    for (const value of ["A".repeat(43), "x", "{}", "%00", "a".repeat(5000)]) {
      const res = await request(app).post("/api/auth/refresh").set("Cookie", `sc_refresh=${value}`);
      expect(res.status, value.slice(0, 20)).toBe(401);
    }
  });

  it("does not take the refresh token from the body or the headers, only from the cookie", async () => {
    const { app } = build();
    const first = await request(app).post("/api/auth/register").send(signUp);
    const token = tokenIn(cookieLine(first));

    const fromBody = await request(app).post("/api/auth/refresh").send({ refreshToken: token });
    const fromHeader = await request(app).post("/api/auth/refresh").set("Authorization", `Bearer ${token}`).set("X-Refresh-Token", token);

    expect(fromBody.status).toBe(401);
    expect(fromHeader.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("answers 204, takes the cookie away and ends the sign in", async () => {
    const { app } = build();
    const first = await request(app).post("/api/auth/register").send(signUp);
    const cookie = cookieLine(first)!.split(";")[0];

    const res = await request(app).post("/api/auth/logout").set("Cookie", cookie);

    expect(res.status).toBe(204);
    expect(cookieLine(res)).toMatch(/sc_refresh=;/);
    expect((await request(app).post("/api/auth/refresh").set("Cookie", cookie)).status).toBe(401);
  });

  it("answers 204 also when nobody was signed in", async () => {
    const { app } = build();

    expect((await request(app).post("/api/auth/logout")).status).toBe(204);
  });
});

describe("POST /api/auth/forgot-password", () => {
  it("answers the same for an address with an account and one without", async () => {
    const { app, mail } = build();
    await request(app).post("/api/auth/register").send(signUp);

    const known = await request(app).post("/api/auth/forgot-password").send({ email: signUp.email });
    const unknown = await request(app).post("/api/auth/forgot-password").send({ email: "nobody@example.com" });

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
    expect(mail.sendPasswordReset).toHaveBeenCalledTimes(1);
  });

  it("refuses something that is not an email", async () => {
    const { app } = build();

    for (const body of [{}, { email: "nope" }, { email: { $ne: null } }]) {
      expect((await request(app).post("/api/auth/forgot-password").send(body)).status, JSON.stringify(body)).toBe(400);
    }
  });

  it("sends at most three reset emails an hour for one address, however the case is written", async () => {
    const { app, mail } = build();
    await request(app).post("/api/auth/register").send(signUp);

    const answers = [];
    for (const email of [signUp.email, "ISABEL@example.com", " isabel@example.com ", signUp.email]) {
      answers.push((await request(app).post("/api/auth/forgot-password").send({ email })).status);
    }

    expect(answers).toEqual([200, 200, 200, 429]);
    expect(mail.sendPasswordReset).toHaveBeenCalledTimes(3);
  });

  it("does not let the limit of one address stop another", async () => {
    const { app } = build();

    for (let attempt = 0; attempt < 3; attempt++) await request(app).post("/api/auth/forgot-password").send({ email: signUp.email });

    expect((await request(app).post("/api/auth/forgot-password").send({ email: "other@example.com" })).status).toBe(200);
  });
});

describe("POST /api/auth/reset-password", () => {
  async function askForLink() {
    const context = build();
    const first = await request(context.app).post("/api/auth/register").send(signUp);
    await request(context.app).post("/api/auth/forgot-password").send({ email: signUp.email });
    const token = new URL(context.mail.sendPasswordReset.mock.calls[0][1]).searchParams.get("token")!;
    return { ...context, first, token };
  }

  it("sets the new password and answers 204 with nothing in the body", async () => {
    const { app, token } = await askForLink();

    const res = await request(app).post("/api/auth/reset-password").send({ token, password: "brand new pass 7" });

    expect(res.status).toBe(204);
    expect(res.text).toBe("");
    expect((await request(app).post("/api/auth/login").send({ email: signUp.email, password: "brand new pass 7" })).status).toBe(200);
    expect((await request(app).post("/api/auth/login").send({ email: signUp.email, password: signUp.password })).status).toBe(401);
  });

  it("ends the sign ins that were open", async () => {
    const { app, token, first } = await askForLink();

    await request(app).post("/api/auth/reset-password").send({ token, password: "brand new pass 7" });

    expect((await request(app).post("/api/auth/refresh").set("Cookie", cookieLine(first)!.split(";")[0])).status).toBe(401);
  });

  it("works once", async () => {
    const { app, token } = await askForLink();
    await request(app).post("/api/auth/reset-password").send({ token, password: "brand new pass 7" });

    const res = await request(app).post("/api/auth/reset-password").send({ token, password: "another pass 8888" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("RESET_LINK_INVALID");
  });

  it("refuses a token that is not the shape of ours without even looking for it, and one that is made up", async () => {
    const { app } = await askForLink();

    for (const token of ["short", "", { $ne: null }, "A".repeat(43), "A".repeat(44), 5]) {
      const res = await request(app).post("/api/auth/reset-password").send({ token, password: "brand new pass 7" });
      expect(res.status, JSON.stringify(token)).toBe(400);
    }
  });

  it("holds the new password to the same rules as at sign up, and keeps the link for another try", async () => {
    const { app, token } = await askForLink();

    const weak = await request(app).post("/api/auth/reset-password").send({ token, password: "short1" });
    expect(weak.status).toBe(400);
    expect(weak.body.error.details[0].field).toBe("password");

    expect((await request(app).post("/api/auth/reset-password").send({ token, password: "a better pass 12" })).status).toBe(204);
  });

  it("counts failed tries against the address", async () => {
    const { app } = build({ loginLimit: 3 });

    const answers = [];
    for (let attempt = 0; attempt < 5; attempt++) {
      answers.push((await request(app).post("/api/auth/reset-password").send({ token: "A".repeat(43), password: "brand new pass 7" })).status);
    }

    expect(answers).toEqual([400, 400, 400, 429, 429]);
  });
});

describe("every answer of the auth routes", () => {
  it("is never kept by a cache", async () => {
    const { app } = build();

    const register = await request(app).post("/api/auth/register").send(signUp);
    const login = await request(app).post("/api/auth/login").send({ email: signUp.email, password: "wrong 12345" });
    const refresh = await request(app).post("/api/auth/refresh");

    for (const res of [register, login, refresh]) expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("uses the standard error shape, with no stack and nothing from the database", async () => {
    const { app } = build();

    const res = await request(app).post("/api/auth/login").send({ email: signUp.email, password: "wrong 12345" });

    expect(Object.keys(res.body)).toEqual(["error"]);
    expect(Object.keys(res.body.error).sort()).toEqual(["code", "details", "message"]);
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.ts|mongo|stack/i);
  });
});
