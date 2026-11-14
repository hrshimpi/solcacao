import express from "express";
import { SignJWT } from "jose";
import { pino } from "pino";
import { pinoHttp } from "pino-http";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { env } from "../config/env.ts";
import { errorHandler } from "./errorHandler.ts";
import { authIfPresent, createRequireStaff, optionalAuth, requireAccountType, requireAdmin, requireAuth, signToken, staffKeyMatches } from "./auth.ts";

const app = express();
app.use(pinoHttp({ logger: pino({ level: "silent" }) }));
app.get("/optional", optionalAuth, (req, res) => void res.json({ user: req.user ?? null }));
app.get("/admin", requireAdmin, (req, res) => void res.json({ user: req.user }));
app.get("/visitor-or-user", authIfPresent, (req, res) => void res.json({ user: req.user ?? null }));
app.get("/signed-in", requireAuth, (req, res) => void res.json({ user: req.user }));
app.get("/business", requireAuth, requireAccountType("b2b"), (req, res) => void res.json({ user: req.user }));
app.get("/business-without-auth", requireAccountType("b2b"), (_req, res) => void res.json({ ok: true }));
app.use(errorHandler);

const secret = new TextEncoder().encode(env.JWT_SECRET);
const user = { id: "64b7f0c2a1b2c3d4e5f60718", role: "user" as const, accountType: "retail" as const };
const admin = { id: "64b7f0c2a1b2c3d4e5f60719", role: "admin" as const, accountType: "retail" as const };
const business = { id: "64b7f0c2a1b2c3d4e5f6071a", role: "user" as const, accountType: "b2b" as const };

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

// a token signed by hand, to try the ways a token can be wrong
function customToken(options: { key?: Uint8Array; expires?: number | string; alg?: string; claims?: Record<string, unknown>; subject?: string }) {
  const jwt = new SignJWT({ role: "admin", ...options.claims }).setProtectedHeader({ alg: options.alg ?? "HS256" }).setIssuedAt();
  if (options.subject !== "") jwt.setSubject(options.subject ?? admin.id);
  return jwt.setExpirationTime(options.expires ?? "1h").sign(options.key ?? secret);
}

describe("optionalAuth", () => {
  it("lets a request without a token through, as nobody", async () => {
    const res = await request(app).get("/optional");

    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });

  it("sets the user from a good token", async () => {
    const res = await request(app).get("/optional").set(bearer(await signToken(user)));

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual(user);
  });

  it("reads the Bearer word in any case", async () => {
    const res = await request(app).get("/optional").set("Authorization", `bearer ${await signToken(user)}`);

    expect(res.body.user).toEqual(user);
  });

  it("treats a token that is not good as no token, instead of failing the request", async () => {
    const wrongKey = new TextEncoder().encode("another secret that is long enough");
    const bad = [
      "not a token",
      "a.b.c",
      await customToken({ key: wrongKey }),
      await customToken({ expires: Math.floor(Date.now() / 1000) - 60 }),
      await customToken({ claims: { role: "owner" } }),
      await customToken({ subject: "" }),
      await customToken({ alg: "HS512" }),
    ];

    for (const token of bad) {
      const res = await request(app).get("/optional").set(bearer(token));
      expect(res.status, token).toBe(200);
      expect(res.body.user, token).toBeNull();
    }
  });

  it("ignores a token that was changed after it was signed", async () => {
    const [header, , signature] = (await signToken(user)).split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ sub: user.id, role: "admin", exp: 9999999999 })).toString("base64url");

    const res = await request(app).get("/optional").set(bearer(`${header}.${forgedPayload}.${signature}`));

    expect(res.body.user).toBeNull();
  });

  it("ignores a token that is not signed at all", async () => {
    const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const unsigned = `${part({ alg: "none", typ: "JWT" })}.${part({ sub: admin.id, role: "admin", exp: 9999999999 })}.`;

    const res = await request(app).get("/optional").set(bearer(unsigned));

    expect(res.body.user).toBeNull();
  });

  it("ignores other kinds of Authorization headers", async () => {
    const res = await request(app).get("/optional").set("Authorization", `Basic ${await signToken(user)}`);

    expect(res.body.user).toBeNull();
  });
});

describe("requireAdmin", () => {
  it("lets an admin through", async () => {
    const res = await request(app).get("/admin").set(bearer(await signToken(admin)));

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual(admin);
  });

  it("answers 401 in the standard shape without a token", async () => {
    const res = await request(app).get("/admin");

    expect(res.status).toBe(401);
    expect(res.body.error).toEqual({ code: "UNAUTHENTICATED", message: "Please sign in to do that.", details: [] });
  });

  it("answers 401 for a token that is not good", async () => {
    const wrongKey = new TextEncoder().encode("another secret that is long enough");

    for (const token of ["not a token", await customToken({ key: wrongKey })]) {
      const res = await request(app).get("/admin").set(bearer(token));
      expect(res.status, token).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
    }
  });

  it("answers 401 with its own code for a good token that ran out, so a client knows to refresh", async () => {
    const expired = await customToken({ expires: Math.floor(Date.now() / 1000) - 60 });

    const res = await request(app).get("/admin").set(bearer(expired));

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("TOKEN_EXPIRED");
  });

  it("answers 403 in the standard shape for a user who is not an admin", async () => {
    const res = await request(app).get("/admin").set(bearer(await signToken(user)));

    expect(res.status).toBe(403);
    expect(res.body.error).toEqual({ code: "FORBIDDEN", message: "You don't have access to that.", details: [] });
  });
});

describe("requireAuth", () => {
  it("lets a signed in user through, whatever the account type", async () => {
    for (const person of [user, admin, business]) {
      const res = await request(app).get("/signed-in").set(bearer(await signToken(person)));
      expect(res.status).toBe(200);
      expect(res.body.user).toEqual(person);
    }
  });

  it("answers 401 in the standard shape without a token, or with one that is not good", async () => {
    for (const headers of [{}, bearer("not a token")]) {
      const res = await request(app).get("/signed-in").set(headers);
      expect(res.status).toBe(401);
      expect(res.body.error).toEqual({ code: "UNAUTHENTICATED", message: "Please sign in to do that.", details: [] });
    }
  });

  it("says TOKEN_EXPIRED for a good token that ran out", async () => {
    const expired = await customToken({ expires: Math.floor(Date.now() / 1000) - 60 });

    const res = await request(app).get("/signed-in").set(bearer(expired));

    expect(res.status).toBe(401);
    expect(res.body.error).toEqual({ code: "TOKEN_EXPIRED", message: "Your session ran out. Please sign in again.", details: [] });
  });

  it("does not say TOKEN_EXPIRED for a token that ran out and is also forged", async () => {
    const wrongKey = new TextEncoder().encode("another secret that is long enough");
    const forged = await customToken({ key: wrongKey, expires: Math.floor(Date.now() / 1000) - 60 });

    const res = await request(app).get("/signed-in").set(bearer(forged));

    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("requireAccountType", () => {
  it("lets a business account through", async () => {
    const res = await request(app).get("/business").set(bearer(await signToken(business)));

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual(business);
  });

  it("answers 403 in the standard shape for a retail account", async () => {
    const res = await request(app).get("/business").set(bearer(await signToken(user)));

    expect(res.status).toBe(403);
    expect(res.body.error).toEqual({ code: "FORBIDDEN", message: "You don't have access to that.", details: [] });
  });

  it("counts an account as retail when the token does not say, or says something else", async () => {
    for (const accountType of [undefined, "", "business", "B2B", 1, null]) {
      const token = await customToken({ claims: { role: "user", accountType } });
      const res = await request(app).get("/business").set(bearer(token));
      expect(res.status, String(accountType)).toBe(403);
    }
  });

  it("answers 401 for a guest, and does not let a missing sign in through when used alone", async () => {
    expect((await request(app).get("/business")).status).toBe(401);
    expect((await request(app).get("/business-without-auth")).status).toBe(401);
  });

  it("makes no difference whether the signed in user is an admin", async () => {
    const adminAccount = { ...admin, accountType: "retail" as const };

    expect((await request(app).get("/business").set(bearer(await signToken(adminAccount)))).status).toBe(403);
    expect((await request(app).get("/business").set(bearer(await signToken({ ...admin, accountType: "b2b" })))).status).toBe(200);
  });
});

describe("signToken", () => {
  it("puts the account type in the token, retail when it is left out", async () => {
    const claims = async (token: string) => JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());

    expect(await claims(await signToken({ id: user.id, role: "user" }))).toMatchObject({ accountType: "retail" });
    expect(await claims(await signToken(business))).toMatchObject({ accountType: "b2b" });
  });

  it("makes a short lived token by default, as long as ACCESS_TOKEN_MINUTES", async () => {
    const token = await signToken(user);
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());

    expect(payload).toMatchObject({ sub: user.id, role: "user" });
    expect(payload.exp - payload.iat).toBe(env.ACCESS_TOKEN_MINUTES * 60);
  });

  it("can be told how long it should last", async () => {
    const payload = JSON.parse(Buffer.from((await signToken(user, "7d")).split(".")[1], "base64url").toString());

    expect(payload.exp - payload.iat).toBe(7 * 24 * 3600);
  });
});

describe("requireStaff", () => {
  const staffKey = "a-staff-key-with-enough-length";
  const staffApp = express();
  staffApp.use(pinoHttp({ logger: pino({ level: "silent" }) }));
  staffApp.get("/staff", createRequireStaff(() => staffKey), (req, res) => void res.json({ user: req.user ?? null }));
  staffApp.get("/staff-without-a-key", createRequireStaff(() => ""), (req, res) => void res.json({ user: req.user ?? null }));
  staffApp.use(errorHandler);

  it("lets the staff key through, without a user", async () => {
    const res = await request(staffApp).get("/staff").set("X-Staff-Key", staffKey);

    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });

  it("lets an admin through, without the key", async () => {
    const res = await request(staffApp).get("/staff").set(bearer(await signToken(admin)));

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual(admin);
  });

  it("refuses a wrong key, a key of another length and an empty one as not signed in", async () => {
    for (const key of ["wrong", `${staffKey}x`, staffKey.slice(0, -1), ""]) {
      const res = await request(staffApp).get("/staff").set("X-Staff-Key", key);
      expect(res.status, key).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
    }
  });

  it("refuses a user who is not an admin, even with a good token", async () => {
    const res = await request(staffApp).get("/staff").set(bearer(await signToken(user)));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("does not let an empty key setting be matched by an empty header", async () => {
    // when no key is set the key is off: nothing a client sends can match it
    for (const headers of [{ "X-Staff-Key": "" }, { "X-Staff-Key": "anything" }, {}]) {
      const res = await request(staffApp).get("/staff-without-a-key").set(headers);
      expect(res.status).toBe(401);
    }
  });

  it("says TOKEN_EXPIRED for an admin token that ran out", async () => {
    const res = await request(staffApp).get("/staff").set(bearer(await customToken({ expires: Math.floor(Date.now() / 1000) - 60 })));

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("TOKEN_EXPIRED");
  });
});

describe("staffKeyMatches", () => {
  it("compares only text, and never matches when the expected key is empty", () => {
    expect(staffKeyMatches("abc", "abc")).toBe(true);
    expect(staffKeyMatches("abc", "abd")).toBe(false);
    expect(staffKeyMatches(["abc"], "abc")).toBe(false);
    expect(staffKeyMatches(undefined, "abc")).toBe(false);
    expect(staffKeyMatches("", "")).toBe(false);
  });
});

describe("authIfPresent", () => {
  it("lets a request with no Authorization header through, as a visitor", async () => {
    const res = await request(app).get("/visitor-or-user");

    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });

  it("sets the user from a good token", async () => {
    const res = await request(app).get("/visitor-or-user").set(bearer(await signToken(user)));

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual(user);
  });

  it("refuses a token that ran out with TOKEN_EXPIRED, instead of treating the person as a visitor", async () => {
    const res = await request(app).get("/visitor-or-user").set(bearer(await customToken({ expires: Math.floor(Date.now() / 1000) - 60 })));

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("TOKEN_EXPIRED");
  });

  it("refuses a token that is not good, and a header that is not a Bearer token, with UNAUTHENTICATED", async () => {
    const wrongKey = new TextEncoder().encode("another secret that is long enough");

    for (const header of ["Bearer not-a-token", `Bearer ${await customToken({ key: wrongKey })}`, "Basic dXNlcjpwYXNz", "Bearer", ""]) {
      const res = await request(app).get("/visitor-or-user").set("Authorization", header);
      expect(res.status, header).toBe(401);
      expect(res.body.error.code, header).toBe("UNAUTHENTICATED");
    }
  });
});
