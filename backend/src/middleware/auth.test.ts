import express from "express";
import { SignJWT } from "jose";
import { pino } from "pino";
import { pinoHttp } from "pino-http";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { env } from "../config/env.ts";
import { errorHandler } from "./errorHandler.ts";
import { optionalAuth, requireAccountType, requireAdmin, requireAuth, signToken } from "./auth.ts";

const app = express();
app.use(pinoHttp({ logger: pino({ level: "silent" }) }));
app.get("/optional", optionalAuth, (req, res) => void res.json({ user: req.user ?? null }));
app.get("/admin", requireAdmin, (req, res) => void res.json({ user: req.user }));
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
    const expired = await customToken({ expires: Math.floor(Date.now() / 1000) - 60 });

    for (const token of ["not a token", expired]) {
      const res = await request(app).get("/admin").set(bearer(token));
      expect(res.status, token).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
    }
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
    const expired = await customToken({ expires: Math.floor(Date.now() / 1000) - 60 });

    for (const headers of [{}, bearer("not a token"), bearer(expired)]) {
      const res = await request(app).get("/signed-in").set(headers);
      expect(res.status).toBe(401);
      expect(res.body.error).toEqual({ code: "UNAUTHENTICATED", message: "Please sign in to do that.", details: [] });
    }
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

  it("makes a token that lasts an hour by default", async () => {
    const token = await signToken(user);
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());

    expect(payload).toMatchObject({ sub: user.id, role: "user" });
    expect(payload.exp - payload.iat).toBe(3600);
  });

  it("can be told how long it should last", async () => {
    const payload = JSON.parse(Buffer.from((await signToken(user, "7d")).split(".")[1], "base64url").toString());

    expect(payload.exp - payload.iat).toBe(7 * 24 * 3600);
  });
});
