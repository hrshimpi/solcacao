import cookieParser from "cookie-parser";
import express from "express";
import { pino } from "pino";
import { pinoHttp } from "pino-http";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { signToken } from "../middleware/auth.ts";
import { errorHandler } from "../middleware/errorHandler.ts";
import { createAccountService, MAX_ADDRESSES } from "../services/account.service.ts";
import { createAuthService } from "../services/auth.service.ts";
import { createHasher } from "../services/password.ts";
import { createMemoryAddressStore } from "../test/memoryAddressStore.ts";
import { createMemoryB2BProfileStore } from "../test/memoryB2BProfileStore.ts";
import { createMemorySessionStore } from "../test/memorySessionStore.ts";
import { createMemoryUserStore } from "../test/memoryUserStore.ts";
import { createStaffRouter, createUsersRouter, passwordChangeLimiter } from "./users.routes.ts";

const password = "correct horse 42";
const home = { label: "Home", street: "12 Cacao Lane", city: "Arlington", state: "TX", postalCode: "76010", country: "United States" };
const office = { label: "Office", street: "500 Main St", street2: "Suite 4", city: "Dallas", state: "TX", postalCode: "75201", country: "United States" };

function build(options: { passwordLimit?: number } = {}) {
  const users = createMemoryUserStore();
  const sessions = createMemorySessionStore();
  const profiles = createMemoryB2BProfileStore();
  const addresses = createMemoryAddressStore();
  const auth = createAuthService({
    users,
    sessions,
    profiles,
    mail: { sendPasswordReset: async () => true },
    hasher: createHasher(4),
    settings: { accessTokenMinutes: 15, refreshTokenDays: 7, maxFailedLogins: 5, lockMinutes: 15, resetTokenMinutes: 60, reuseGraceSeconds: 10, siteUrl: "https://shop.example" },
  });
  const service = createAccountService({ users, profiles, addresses, auth });

  const app = express();
  app.use(pinoHttp({ logger: pino({ level: "silent" }) }));
  app.use(cookieParser());
  app.use(express.json({ limit: "100kb" }));
  app.use("/api/users/me", createUsersRouter({ service, passwordLimiter: passwordChangeLimiter({ limit: options.passwordLimit }), secureCookie: false }));
  app.use("/api/staff", createStaffRouter({ service }));
  app.use(errorHandler);

  // a person who signed up, with the access token they got and the cookie of their sign in
  async function signUp(kind: "retail" | "b2b" = "retail", email = `person${users.all().length}@example.com`) {
    const session = await auth.register({ name: "Isabel Vasquez", email, password, accountType: kind, companyName: kind === "b2b" ? "Hacienda Brands" : undefined, preferredLanguage: "en" });
    return { id: session.user.id, token: session.accessToken, refreshToken: session.refreshToken, email };
  }
  const admin = async () => {
    const user = await users.create({ email: "boss@example.com", name: "Boss", passwordHash: "x", accountType: "retail", preferredLanguage: "en", role: "admin" });
    return signToken({ id: user.id, role: "admin", accountType: "retail" });
  };

  return { app, users, sessions, profiles, addresses, signUp, admin, auth };
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("who may use /api/users/me", () => {
  it("needs a signed in user for every route", async () => {
    const { app } = build();
    const id = "64b7f0c2a1b2c3d4e5f607ff";

    for (const [method, path] of [
      ["get", "/api/users/me"],
      ["patch", "/api/users/me"],
      ["patch", "/api/users/me/password"],
      ["get", "/api/users/me/addresses"],
      ["post", "/api/users/me/addresses"],
      ["patch", `/api/users/me/addresses/${id}`],
      ["delete", `/api/users/me/addresses/${id}`],
      ["post", `/api/users/me/addresses/${id}/default`],
      ["get", "/api/users/me/b2b-profile"],
      ["put", "/api/users/me/b2b-profile"],
    ] as const) {
      const res = await request(app)[method](path);
      expect(res.status, `${method} ${path}`).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
    }
  });

  it("says TOKEN_EXPIRED for a token that ran out, so a client knows to refresh", async () => {
    const { app } = build();
    const expired = await signToken({ id: "64b7f0c2a1b2c3d4e5f607ff", role: "user" }, Math.floor(Date.now() / 1000) - 60);

    const res = await request(app).get("/api/users/me").set(bearer(expired));

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("TOKEN_EXPIRED");
  });

  it("asks a person whose account was deleted to sign in again, although the token is still good", async () => {
    const { app, users, signUp } = build();
    const person = await signUp();
    await users.remove(person.id);

    const res = await request(app).get("/api/users/me").set(bearer(person.token));

    expect(res.status).toBe(401);
  });

  it("never lets an answer be kept by a cache", async () => {
    const { app, signUp } = build();
    const person = await signUp();

    const res = await request(app).get("/api/users/me").set(bearer(person.token));

    expect(res.headers["cache-control"]).toBe("no-store");
  });
});

describe("GET and PATCH /api/users/me", () => {
  it("gives the user, without any secret, and no business details for a retail account", async () => {
    const { app, signUp } = build();
    const person = await signUp();

    const res = await request(app).get("/api/users/me").set(bearer(person.token));

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: person.id, email: person.email, name: "Isabel Vasquez", accountType: "retail", role: "user", preferredLanguage: "en", marketingEmails: false });
    expect(res.body.b2bProfile).toBeNull();
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$|failedLogins|lockedUntil|resetToken/);
  });

  it("gives a business account with its business details", async () => {
    const { app, signUp } = build();
    const person = await signUp("b2b");

    const res = await request(app).get("/api/users/me").set(bearer(person.token));

    expect(res.body.b2bProfile).toMatchObject({ companyName: "Hacienda Brands", verificationStatus: "pending" });
  });

  it("changes the name, phone, language and choice about emails", async () => {
    const { app, signUp } = build();
    const person = await signUp();

    const res = await request(app).patch("/api/users/me").set(bearer(person.token)).send({ name: "Isabel V.", phone: "+1 (555) 010-2030", preferredLanguage: "es", marketingEmails: true });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ name: "Isabel V.", phone: "+1 (555) 010-2030", preferredLanguage: "es", marketingEmails: true });
    expect((await request(app).get("/api/users/me").set(bearer(person.token))).body.user.name).toBe("Isabel V.");
  });

  it("takes the phone away when it is sent empty", async () => {
    const { app, signUp } = build();
    const person = await signUp();
    await request(app).patch("/api/users/me").set(bearer(person.token)).send({ phone: "+1 555 010 2030" });

    const res = await request(app).patch("/api/users/me").set(bearer(person.token)).send({ phone: "  " });

    expect(res.status).toBe(200);
    expect(res.body.user.phone).toBeUndefined();
  });

  it("strips tags from the name", async () => {
    const { app, signUp } = build();
    const person = await signUp();

    const res = await request(app).patch("/api/users/me").set(bearer(person.token)).send({ name: "<img src=x onerror=alert(1)>Isabel" });

    expect(res.body.user.name).toBe("Isabel");
  });

  it.each([
    ["the email", { email: "other@example.com" }],
    ["the role", { role: "admin" }],
    ["the type of account", { accountType: "b2b" }],
    ["the password hash", { passwordHash: "x" }],
    ["the id", { id: "64b7f0c2a1b2c3d4e5f607ff" }],
    ["something next to a good field", { name: "Isabel", role: "admin" }],
  ])("refuses to change %s, and changes nothing else either", async (_what, body) => {
    const { app, signUp, users } = build();
    const person = await signUp();

    const res = await request(app).patch("/api/users/me").set(bearer(person.token)).send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toMatch(/only change/);
    expect(users.all()[0]).toMatchObject({ email: person.email, role: "user", accountType: "retail", name: "Isabel Vasquez" });
  });

  it.each([
    ["an empty change", {}],
    ["a phone that is not a phone", { phone: "call me maybe" }],
    ["a language that does not exist", { preferredLanguage: "fr" }],
    ["a choice that is not true or false", { marketingEmails: "yes" }],
    ["a name that is too long", { name: "x".repeat(81) }],
    ["a name that is only tags", { name: "<b></b>" }],
  ])("refuses %s", async (_what, body) => {
    const { app, signUp } = build();
    const person = await signUp();

    const res = await request(app).patch("/api/users/me").set(bearer(person.token)).send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("cannot be used to change another user: the id comes from the token and nothing else", async () => {
    const { app, signUp, users } = build();
    const mine = await signUp("retail", "mine@example.com");
    const theirs = await signUp("retail", "theirs@example.com");

    await request(app).patch("/api/users/me").set(bearer(mine.token)).send({ name: "Changed By Mine" });

    expect(users.all().find((user) => user.id === theirs.id)?.name).toBe("Isabel Vasquez");
  });
});

describe("PATCH /api/users/me/password", () => {
  it("changes the password and answers with a new sign in for this device", async () => {
    const { app, signUp, auth } = build();
    const person = await signUp();

    const res = await request(app).patch("/api/users/me/password").set(bearer(person.token)).send({ currentPassword: password, newPassword: "brand new pass 7" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ user: { id: person.id }, accessToken: expect.any(String), expiresIn: 900 });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|refreshToken/);
    expect(((res.headers["set-cookie"] as unknown as string[]) ?? []).some((line) => /^sc_refresh=.+HttpOnly/i.test(line))).toBe(true);
    await expect(auth.login({ email: person.email, password: "brand new pass 7" })).resolves.toBeDefined();
    await expect(auth.login({ email: person.email, password })).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("ends the other sign ins of the account", async () => {
    const { app, signUp, auth } = build();
    const person = await signUp();
    const otherDevice = await auth.login({ email: person.email, password });

    await request(app).patch("/api/users/me/password").set(bearer(person.token)).send({ currentPassword: password, newPassword: "brand new pass 7" });

    await expect(auth.refresh(otherDevice.refreshToken)).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
    await expect(auth.refresh(person.refreshToken)).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
  });

  it("refuses a wrong current password, naming the field, and changes nothing", async () => {
    const { app, signUp, auth } = build();
    const person = await signUp();

    const res = await request(app).patch("/api/users/me/password").set(bearer(person.token)).send({ currentPassword: "not the one 99", newPassword: "brand new pass 7" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: "WRONG_PASSWORD", details: [{ field: "currentPassword" }] });
    await expect(auth.login({ email: person.email, password })).resolves.toBeDefined();
  });

  it.each([
    ["a new password that is the same as the current one", { currentPassword: password, newPassword: password }, "newPassword"],
    ["a new password that is too weak", { currentPassword: password, newPassword: "short1" }, "newPassword"],
    ["no current password", { newPassword: "brand new pass 7" }, "currentPassword"],
    ["a field that does not belong", { currentPassword: password, newPassword: "brand new pass 7", email: "x@example.com" }, ""],
    ["passwords that are not text", { currentPassword: { $ne: "" }, newPassword: ["brand new pass 7"] }, ""],
  ])("refuses %s", async (_what, body, field) => {
    const { app, signUp } = build();
    const person = await signUp();

    const res = await request(app).patch("/api/users/me/password").set(bearer(person.token)).send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    if (field) expect(res.body.error.details.map((detail: { field: string }) => detail.field)).toContain(field);
  });

  it("stops guessing of the current password after five wrong tries, for that user only", async () => {
    const { app, signUp } = build();
    const person = await signUp("retail", "guessed@example.com");
    const other = await signUp("retail", "other@example.com");

    const answers = [];
    for (let attempt = 0; attempt < 7; attempt++) {
      answers.push((await request(app).patch("/api/users/me/password").set(bearer(person.token)).send({ currentPassword: "wrong guess 12", newPassword: "brand new pass 7" })).status);
    }

    expect(answers).toEqual([400, 400, 400, 400, 400, 429, 429]);
    // somebody else is not affected by it
    expect((await request(app).patch("/api/users/me/password").set(bearer(other.token)).send({ currentPassword: password, newPassword: "brand new pass 7" })).status).toBe(200);
  });
});

describe("addresses", () => {
  it("starts empty, and makes the first address the default", async () => {
    const { app, signUp } = build();
    const person = await signUp();
    expect((await request(app).get("/api/users/me/addresses").set(bearer(person.token))).body).toEqual({ addresses: [] });

    const created = await request(app).post("/api/users/me/addresses").set(bearer(person.token)).send(home);

    expect(created.status).toBe(201);
    expect(created.body.address).toMatchObject({ ...home, isDefault: true, userId: person.id });
    expect(created.body.address.id).toMatch(/^[0-9a-f]{24}$/);
  });

  it("lists the addresses, the oldest first, with only one default", async () => {
    const { app, signUp } = build();
    const person = await signUp();
    await request(app).post("/api/users/me/addresses").set(bearer(person.token)).send(home);
    await request(app).post("/api/users/me/addresses").set(bearer(person.token)).send(office);
    await request(app).post("/api/users/me/addresses").set(bearer(person.token)).send({ ...home, label: "Studio", isDefault: true });

    const { body } = await request(app).get("/api/users/me/addresses").set(bearer(person.token));

    expect(body.addresses.map((address: { label: string }) => address.label)).toEqual(["Home", "Office", "Studio"]);
    expect(body.addresses.filter((address: { isDefault: boolean }) => address.isDefault).map((address: { label: string }) => address.label)).toEqual(["Studio"]);
  });

  it("changes parts of an address, and takes the second line away when it is sent empty", async () => {
    const { app, signUp } = build();
    const person = await signUp();
    const { body } = await request(app).post("/api/users/me/addresses").set(bearer(person.token)).send(office);

    const res = await request(app).patch(`/api/users/me/addresses/${body.address.id}`).set(bearer(person.token)).send({ city: "Irving", street2: "" });

    expect(res.status).toBe(200);
    expect(res.body.address).toMatchObject({ city: "Irving", street: "500 Main St" });
    expect(res.body.address.street2).toBeUndefined();
  });

  it("makes another address the default, and deleting the default hands it on", async () => {
    const { app, signUp } = build();
    const person = await signUp();
    const first = (await request(app).post("/api/users/me/addresses").set(bearer(person.token)).send(home)).body.address;
    const second = (await request(app).post("/api/users/me/addresses").set(bearer(person.token)).send(office)).body.address;

    const chosen = await request(app).post(`/api/users/me/addresses/${second.id}/default`).set(bearer(person.token));
    expect(chosen.status).toBe(200);
    expect(chosen.body.address).toMatchObject({ id: second.id, isDefault: true });

    const deleted = await request(app).delete(`/api/users/me/addresses/${second.id}`).set(bearer(person.token));
    expect(deleted.status).toBe(204);
    expect(deleted.text).toBe("");

    const { body } = await request(app).get("/api/users/me/addresses").set(bearer(person.token));
    expect(body.addresses).toEqual([expect.objectContaining({ id: first.id, isDefault: true })]);
  });

  it("answers 404 for an address that is not there, and the same for one that belongs to somebody else", async () => {
    const { app, signUp } = build();
    const mine = await signUp("retail", "mine@example.com");
    const theirs = await signUp("retail", "theirs@example.com");
    const theirAddress = (await request(app).post("/api/users/me/addresses").set(bearer(theirs.token)).send(home)).body.address;
    const missing = "64b7f0c2a1b2c3d4e5f607ff";

    const answers = [
      await request(app).patch(`/api/users/me/addresses/${theirAddress.id}`).set(bearer(mine.token)).send({ city: "Hacked" }),
      await request(app).patch(`/api/users/me/addresses/${missing}`).set(bearer(mine.token)).send({ city: "Hacked" }),
      await request(app).delete(`/api/users/me/addresses/${theirAddress.id}`).set(bearer(mine.token)),
      await request(app).delete(`/api/users/me/addresses/${missing}`).set(bearer(mine.token)),
      await request(app).post(`/api/users/me/addresses/${theirAddress.id}/default`).set(bearer(mine.token)),
      await request(app).post(`/api/users/me/addresses/${missing}/default`).set(bearer(mine.token)),
    ];

    for (const res of answers) {
      expect(res.status).toBe(404);
      expect(res.body.error).toEqual({ code: "NOT_FOUND", message: "That address wasn't found.", details: [] });
    }
    // and nothing of theirs changed
    const { body } = await request(app).get("/api/users/me/addresses").set(bearer(theirs.token));
    expect(body.addresses).toEqual([expect.objectContaining({ city: "Arlington", isDefault: true })]);
  });

  it("does not show the addresses of others in a list", async () => {
    const { app, signUp } = build();
    const mine = await signUp("retail", "mine@example.com");
    const theirs = await signUp("retail", "theirs@example.com");
    await request(app).post("/api/users/me/addresses").set(bearer(theirs.token)).send(home);

    expect((await request(app).get("/api/users/me/addresses").set(bearer(mine.token))).body.addresses).toEqual([]);
  });

  it("refuses an id that is not an id, with 400", async () => {
    const { app, signUp } = build();
    const person = await signUp();

    for (const id of ["abc", "123", "%7B%22%24ne%22%3Anull%7D", "64b7f0c2a1b2c3d4e5f607f"]) {
      const res = await request(app).delete(`/api/users/me/addresses/${id}`).set(bearer(person.token));
      expect(res.status, id).toBe(400);
      expect(res.body.error.message).toBe("That isn't a valid address id.");
    }
  });

  it(`keeps at most ${MAX_ADDRESSES} addresses and says so with 409`, async () => {
    const { app, signUp } = build();
    const person = await signUp();
    for (let index = 0; index < MAX_ADDRESSES; index++) {
      expect((await request(app).post("/api/users/me/addresses").set(bearer(person.token)).send({ ...home, label: `Place ${index}` })).status).toBe(201);
    }

    const res = await request(app).post("/api/users/me/addresses").set(bearer(person.token)).send(home);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ADDRESS_LIMIT");
  });

  it("strips tags from the text of an address", async () => {
    const { app, signUp } = build();
    const person = await signUp();

    const res = await request(app).post("/api/users/me/addresses").set(bearer(person.token)).send({ ...home, label: "<script>alert(1)</script>Home", city: "Arl<b>ington</b>" });

    expect(res.status).toBe(201);
    expect(res.body.address).toMatchObject({ label: "Home", city: "Arlington" });
  });

  it("says which fields are wrong, each in words a person can read", async () => {
    const { app, signUp } = build();
    const person = await signUp();

    const res = await request(app).post("/api/users/me/addresses").set(bearer(person.token)).send({ label: "", street: "", postalCode: "<>", country: "x" });

    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((detail: { field: string }) => detail.field);
    expect(fields).toEqual(expect.arrayContaining(["label", "street", "city", "state", "postalCode", "country"]));
  });

  it.each([
    ["the owner", { userId: "64b7f0c2a1b2c3d4e5f607ff" }],
    ["the id", { id: "64b7f0c2a1b2c3d4e5f607ff" }],
    ["when it was made", { createdAt: "2020-01-01T00:00:00.000Z" }],
  ])("refuses an address that tries to set %s", async (_what, extra) => {
    const { app, signUp } = build();
    const person = await signUp();

    const res = await request(app).post("/api/users/me/addresses").set(bearer(person.token)).send({ ...home, ...extra });

    expect(res.status).toBe(400);
  });

  it("does not let a change decide which address is the default, or whose it is", async () => {
    const { app, signUp } = build();
    const person = await signUp();
    const first = (await request(app).post("/api/users/me/addresses").set(bearer(person.token)).send(home)).body.address;
    const second = (await request(app).post("/api/users/me/addresses").set(bearer(person.token)).send(office)).body.address;

    for (const body of [{ isDefault: true }, { userId: "64b7f0c2a1b2c3d4e5f607ff" }, {}]) {
      const res = await request(app).patch(`/api/users/me/addresses/${second.id}`).set(bearer(person.token)).send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect((await request(app).get("/api/users/me/addresses").set(bearer(person.token))).body.addresses.find((address: { isDefault: boolean }) => address.isDefault).id).toBe(first.id);
  });
});

describe("business details", () => {
  it("are for business accounts only", async () => {
    const { app, signUp } = build();
    const person = await signUp("retail");

    for (const res of [
      await request(app).get("/api/users/me/b2b-profile").set(bearer(person.token)),
      await request(app).put("/api/users/me/b2b-profile").set(bearer(person.token)).send({ companyName: "Marco Foods" }),
    ]) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    }
  });

  it("start with the company from sign up, waiting for verification", async () => {
    const { app, signUp } = build();
    const person = await signUp("b2b");

    const res = await request(app).get("/api/users/me/b2b-profile").set(bearer(person.token));

    expect(res.status).toBe(200);
    expect(res.body.b2bProfile).toMatchObject({ userId: person.id, companyName: "Hacienda Brands", verificationStatus: "pending" });
  });

  it("are changed with PUT, and an empty tax id or industry takes it away", async () => {
    const { app, signUp } = build();
    const person = await signUp("b2b");
    await request(app).put("/api/users/me/b2b-profile").set(bearer(person.token)).send({ companyName: "Hacienda Brands LLC", taxId: "12-3456789", industry: "Hospitality" });

    const res = await request(app).put("/api/users/me/b2b-profile").set(bearer(person.token)).send({ companyName: "Hacienda Brands LLC", taxId: "" });

    expect(res.status).toBe(200);
    expect(res.body.b2bProfile).toMatchObject({ companyName: "Hacienda Brands LLC", industry: "Hospitality" });
    expect(res.body.b2bProfile.taxId).toBeUndefined();
  });

  it("cannot be verified by the person, however it is asked", async () => {
    const { app, signUp, profiles } = build();
    const person = await signUp("b2b");

    for (const body of [{ companyName: "Hacienda", verificationStatus: "verified" }, { companyName: "Hacienda", verified: true }]) {
      const res = await request(app).put("/api/users/me/b2b-profile").set(bearer(person.token)).send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect((await profiles.findByUserId(person.id))?.verificationStatus).toBe("pending");
  });

  it("need a company", async () => {
    const { app, signUp } = build();
    const person = await signUp("b2b");

    const res = await request(app).put("/api/users/me/b2b-profile").set(bearer(person.token)).send({ taxId: "12-3456789" });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe("companyName");
  });

  it("are not found for a business that has none, instead of an empty answer", async () => {
    const { app, signUp, profiles } = build();
    const person = await signUp("b2b");
    await profiles.remove(person.id);

    const res = await request(app).get("/api/users/me/b2b-profile").set(bearer(person.token));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

describe("PATCH /api/staff/b2b-profiles/:userId", () => {
  it("lets an admin verify a business, and the business keeps it when it saves its details", async () => {
    const { app, signUp, admin } = build();
    const person = await signUp("b2b");

    const res = await request(app).patch(`/api/staff/b2b-profiles/${person.id}`).set(bearer(await admin())).send({ verificationStatus: "verified" });

    expect(res.status).toBe(200);
    expect(res.body.b2bProfile.verificationStatus).toBe("verified");
    await request(app).put("/api/users/me/b2b-profile").set(bearer(person.token)).send({ companyName: "Hacienda Brands LLC" });
    expect((await request(app).get("/api/users/me/b2b-profile").set(bearer(person.token))).body.b2bProfile.verificationStatus).toBe("verified");
  });

  it("is refused to everybody who is not staff", async () => {
    const { app, signUp } = build();
    const person = await signUp("b2b");
    const path = `/api/staff/b2b-profiles/${person.id}`;

    const guest = await request(app).patch(path).send({ verificationStatus: "verified" });
    const ownBusiness = await request(app).patch(path).set(bearer(person.token)).send({ verificationStatus: "verified" });
    const wrongKey = await request(app).patch(path).set("X-Staff-Key", "not-the-key").send({ verificationStatus: "verified" });

    expect([guest.status, ownBusiness.status, wrongKey.status]).toEqual([401, 403, 401]);
  });

  it("refuses a status that does not exist, and a user with no business details", async () => {
    const { app, signUp, admin } = build();
    const person = await signUp("b2b");
    const retail = await signUp("retail", "marco@example.com");
    const token = await admin();

    const bad = await request(app).patch(`/api/staff/b2b-profiles/${person.id}`).set(bearer(token)).send({ verificationStatus: "great" });
    const none = await request(app).patch(`/api/staff/b2b-profiles/${retail.id}`).set(bearer(token)).send({ verificationStatus: "verified" });
    const notAnId = await request(app).patch("/api/staff/b2b-profiles/abc").set(bearer(token)).send({ verificationStatus: "verified" });

    expect([bad.status, none.status, notAnId.status]).toEqual([400, 404, 400]);
  });
});
