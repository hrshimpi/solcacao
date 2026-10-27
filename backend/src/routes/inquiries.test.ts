import express from "express";
import mongoose from "mongoose";
import { SignJWT } from "jose";
import { pino } from "pino";
import { pinoHttp } from "pino-http";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { env } from "../config/env.ts";
import { AppError } from "../errors/AppError.ts";
import { signToken } from "../middleware/auth.ts";
import { errorHandler } from "../middleware/errorHandler.ts";
import { createInquiryService } from "../services/inquiry.service.ts";
import type { InquiryStore } from "../services/inquiry.store.ts";
import { createMemoryInquiryStore } from "../test/memoryInquiryStore.ts";
import { createInquiryRouter, inquiryRateLimiter } from "./inquiries.ts";

const general = {
  category: "general",
  name: "Isabel Vasquez",
  email: "isabel@example.com",
  message: "Do you ship the Ecuador bar to Canada?",
};

// the routes with a store in memory and a mail service that is only a spy, in front of the normal error handler
function build(options: { limit?: number; windowMs?: number; store?: InquiryStore & { all?: () => unknown[] } } = {}) {
  const memory = createMemoryInquiryStore();
  const store = options.store ?? memory;
  const mail = {
    sendInquiryEmail: vi.fn(async () => true),
    sendNewsletterWelcome: vi.fn(async () => true),
  };
  const service = createInquiryService({ store, mail });

  const app = express();
  app.set("trust proxy", "loopback");
  app.use(pinoHttp({ logger: pino({ level: "silent" }) }));
  app.use(express.json({ limit: "100kb" }));
  app.use("/api/inquiries", createInquiryRouter({ service, limiter: inquiryRateLimiter({ limit: options.limit, windowMs: options.windowMs }) }));
  app.use(errorHandler);

  return { app, store: memory, mail };
}

const objectId = () => new mongoose.Types.ObjectId().toString();
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const adminToken = () => signToken({ id: objectId(), role: "admin" });
const userToken = (id = objectId()) => signToken({ id, role: "user" });

describe("POST /api/inquiries: every category", () => {
  it.each(["general", "wholesale", "support"])("saves a %s message, answers 201 { id } and emails the team", async (category) => {
    const { app, store, mail } = build();

    const res = await request(app).post("/api/inquiries").send({ ...general, category });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: expect.stringMatching(/^[0-9a-f]{24}$/) });
    expect(store.all()).toEqual([expect.objectContaining({ id: res.body.id, category, name: "Isabel Vasquez", email: "isabel@example.com", status: "new" })]);
    expect(mail.sendInquiryEmail).toHaveBeenCalledTimes(1);
    expect(mail.sendInquiryEmail).toHaveBeenCalledWith(expect.objectContaining({ category, name: "Isabel Vasquez", email: "isabel@example.com", message: general.message }));
    expect(mail.sendNewsletterWelcome).not.toHaveBeenCalled();
  });

  it("saves feedback with only a rating", async () => {
    const { app, store, mail } = build();

    const res = await request(app).post("/api/inquiries").send({ category: "feedback", rating: 4 });

    expect(res.status).toBe(201);
    expect(store.all()).toEqual([expect.objectContaining({ category: "feedback", rating: 4 })]);
    expect(mail.sendInquiryEmail).toHaveBeenCalledWith(expect.objectContaining({ category: "feedback", rating: 4 }));
  });

  it("saves feedback with a comment and an email, the rating as text", async () => {
    const { app, store } = build();

    const res = await request(app).post("/api/inquiries").send({ category: "feedback", rating: "5", message: "Loved it", email: "Isabel@Example.com" });

    expect(res.status).toBe(201);
    expect(store.all()[0]).toMatchObject({ rating: 5, message: "Loved it", email: "isabel@example.com" });
  });

  it("saves a newsletter sign up and sends the welcome email instead of the inquiry email", async () => {
    const { app, store, mail } = build();

    const res = await request(app).post("/api/inquiries").send({ category: "newsletter", email: "Isabel@Example.com" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: expect.stringMatching(/^[0-9a-f]{24}$/) });
    expect(store.all()).toEqual([expect.objectContaining({ category: "newsletter", email: "isabel@example.com" })]);
    expect(mail.sendNewsletterWelcome).toHaveBeenCalledTimes(1);
    expect(mail.sendNewsletterWelcome).toHaveBeenCalledWith("isabel@example.com", "en");
    expect(mail.sendInquiryEmail).not.toHaveBeenCalled();
  });

  it("sends the welcome in Spanish when the visitor's browser asks for Spanish", async () => {
    const { app, mail } = build();

    await request(app).post("/api/inquiries").set("Accept-Language", "es-MX,es;q=0.9,en;q=0.8").send({ category: "newsletter", email: "isabel@example.com" });
    await request(app).post("/api/inquiries").set("Accept-Language", "fr-FR,es;q=0.5").send({ category: "newsletter", email: "other@example.com" });
    await request(app).post("/api/inquiries").send({ category: "newsletter", email: "third@example.com" });

    expect(mail.sendNewsletterWelcome.mock.calls.map((call) => call.join(" "))).toEqual([
      "isabel@example.com es",
      "other@example.com en",
      "third@example.com en",
    ]);
  });

  it("strips HTML from what is saved and what is emailed", async () => {
    const { app, store, mail } = build();

    await request(app)
      .post("/api/inquiries")
      .send({ ...general, name: "<b>Isabel</b>", message: "Hello <script>alert(1)</script>there, friend" });

    expect(store.all()[0]).toMatchObject({ name: "Isabel", message: "Hello there, friend" });
    expect(mail.sendInquiryEmail).toHaveBeenCalledWith(expect.objectContaining({ name: "Isabel", message: "Hello there, friend" }));
  });

  it("does not save fields that do not belong to the category", async () => {
    const { app, store } = build();

    await request(app).post("/api/inquiries").send({ ...general, rating: 5, status: "responded", userId: objectId(), id: "mine" });

    const [saved] = store.all() as unknown as Record<string, unknown>[];
    expect(saved).not.toHaveProperty("rating");
    expect(saved.status).toBe("new");
    expect(saved).not.toHaveProperty("userId");
    expect(saved.id).not.toBe("mine");
  });

  it("answers 201 even when the email cannot be sent", async () => {
    const { app, store, mail } = build();
    mail.sendInquiryEmail.mockRejectedValue(new Error("smtp is down"));

    const res = await request(app).post("/api/inquiries").send(general);

    expect(res.status).toBe(201);
    expect(store.all()).toHaveLength(1);
  });
});

describe("POST /api/inquiries: validation", () => {
  it("answers 400 in the standard shape, naming every field that is wrong", async () => {
    const { app, store, mail } = build();

    const res = await request(app).post("/api/inquiries").send({ category: "general" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Please enter your name.",
        details: [
          { field: "name", message: "Please enter your name." },
          { field: "email", message: "Please enter your email address." },
          { field: "message", message: "Please write a message." },
        ],
      },
    });
    expect(store.all()).toEqual([]);
    expect(mail.sendInquiryEmail).not.toHaveBeenCalled();
  });

  it("explains a wrong email, a short message and a short name", async () => {
    const { app } = build();

    const res = await request(app).post("/api/inquiries").send({ ...general, name: "I", email: "isabel", message: "short" });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { field: "name", message: "Your name needs at least 2 characters." },
      { field: "email", message: "That email address doesn't look right. It should look like name@example.com." },
      { field: "message", message: "Your message needs at least 10 characters." },
    ]);
  });

  it("says what is wrong with a rating", async () => {
    const { app } = build();

    for (const rating of [0, 6, 2.5, "five", undefined]) {
      const res = await request(app).post("/api/inquiries").send({ category: "feedback", rating });
      expect(res.status).toBe(400);
      expect(res.body.error.details).toEqual([{ field: "rating", message: "Please give a rating from 1 to 5." }]);
    }
  });

  it("asks for an email for a newsletter sign up", async () => {
    const { app } = build();

    const res = await request(app).post("/api/inquiries").send({ category: "newsletter" });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: "email", message: "Please enter your email address." }]);
  });

  it.each([{}, { category: "complaint" }, { category: "General" }, { ...general, category: undefined }])("asks for a category: %j", async (body) => {
    const { app } = build();

    const res = await request(app).post("/api/inquiries").send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toContain("Please choose what your message is about");
  });

  it("answers 400 in the standard shape for a body that is not JSON, or not an object", async () => {
    const { app } = build();

    const broken = await request(app).post("/api/inquiries").set("Content-Type", "application/json").send("{not json");
    expect(broken.status).toBe(400);
    expect(broken.body.error.code).toBe("INVALID_JSON");

    const list = await request(app).post("/api/inquiries").set("Content-Type", "application/json").send("[]");
    expect(list.status).toBe(400);
    expect(list.body.error.code).toBe("VALIDATION_ERROR");

    for (const body of ["\"text\"", "42", "null"]) {
      const res = await request(app).post("/api/inquiries").set("Content-Type", "application/json").send(body);
      expect(res.status, body).toBe(400);
      expect(res.body.error.code).toBe("INVALID_JSON");
    }

    const empty = await request(app).post("/api/inquiries");
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/inquiries: the honeypot", () => {
  const bot = "https://spam.example";

  it("answers 201 like a success, and saves and emails nothing", async () => {
    const { app, store, mail } = build();

    const res = await request(app).post("/api/inquiries").send({ ...general, website: bot });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: expect.stringMatching(/^[0-9a-f]{24}$/) });
    expect(store.all()).toEqual([]);
    expect(mail.sendInquiryEmail).not.toHaveBeenCalled();
    expect(mail.sendNewsletterWelcome).not.toHaveBeenCalled();
  });

  it("is ignored for every category, and also when the rest of the form is wrong", async () => {
    const { app, store, mail } = build();

    for (const body of [
      { category: "wholesale", name: "x", email: "x", message: "x", website: bot },
      { category: "feedback", rating: 5, website: bot },
      { category: "newsletter", email: "isabel@example.com", website: bot },
      { category: "newsletter", website: bot },
      { website: bot },
    ]) {
      const res = await request(app).post("/api/inquiries").send(body);
      expect(res.status, JSON.stringify(body)).toBe(201);
      expect(res.body.id).toMatch(/^[0-9a-f]{24}$/);
    }

    expect(store.all()).toEqual([]);
    expect(mail.sendInquiryEmail).not.toHaveBeenCalled();
    expect(mail.sendNewsletterWelcome).not.toHaveBeenCalled();
  });

  it("gives a different made up id every time", async () => {
    const { app } = build();

    const first = await request(app).post("/api/inquiries").send({ ...general, website: bot });
    const second = await request(app).post("/api/inquiries").send({ ...general, website: bot });

    expect(first.body.id).not.toBe(second.body.id);
  });

  it("is fine with an empty website field, like a real visitor sends", async () => {
    const { app, store } = build();

    const res = await request(app).post("/api/inquiries").send({ ...general, website: "" });

    expect(res.status).toBe(201);
    expect(store.all()).toHaveLength(1);
  });

  it("still counts towards the limit, so a bot cannot flood the route either", async () => {
    const { app } = build({ limit: 2 });

    await request(app).post("/api/inquiries").send({ ...general, website: bot });
    await request(app).post("/api/inquiries").send({ ...general, website: bot });

    expect((await request(app).post("/api/inquiries").send(general)).status).toBe(429);
  });
});

describe("POST /api/inquiries: the limit of 5 every 15 minutes per IP", () => {
  it("answers 429 to the 6th message, in the standard shape", async () => {
    const { app, store, mail } = build();

    for (let i = 1; i <= 5; i++) expect((await request(app).post("/api/inquiries").send(general)).status, `message ${i}`).toBe(201);
    const sixth = await request(app).post("/api/inquiries").send(general);

    expect(sixth.status).toBe(429);
    expect(sixth.body.error).toEqual({
      code: "RATE_LIMITED",
      message: "You have sent a lot of messages. Please try again in a few minutes.",
      details: [],
    });
    expect(Number(sixth.headers["retry-after"])).toBeGreaterThan(0);
    expect(Number(sixth.headers["retry-after"])).toBeLessThanOrEqual(15 * 60);
    expect(store.all()).toHaveLength(5);
    expect(mail.sendInquiryEmail).toHaveBeenCalledTimes(5);
  });

  it("keeps saying 429 until the time is up", async () => {
    const { app } = build({ limit: 1 });
    await request(app).post("/api/inquiries").send(general);

    for (let i = 0; i < 3; i++) expect((await request(app).post("/api/inquiries").send(general)).status).toBe(429);
  });

  it("counts each IP address on its own", async () => {
    const { app } = build({ limit: 2 });

    for (let i = 0; i < 2; i++) await request(app).post("/api/inquiries").set("X-Forwarded-For", "10.0.0.1").send(general);

    expect((await request(app).post("/api/inquiries").set("X-Forwarded-For", "10.0.0.1").send(general)).status).toBe(429);
    expect((await request(app).post("/api/inquiries").set("X-Forwarded-For", "10.0.0.2").send(general)).status).toBe(201);
  });

  it("does not use up turns on messages that were refused", async () => {
    const { app } = build();

    for (let i = 0; i < 8; i++) expect((await request(app).post("/api/inquiries").send({ category: "general" })).status).toBe(400);
    for (let i = 0; i < 5; i++) expect((await request(app).post("/api/inquiries").send(general)).status).toBe(201);

    expect((await request(app).post("/api/inquiries").send(general)).status).toBe(429);
  });

  it("lets messages through again after the window", async () => {
    const { app } = build({ limit: 1, windowMs: 200 });
    await request(app).post("/api/inquiries").send(general);
    expect((await request(app).post("/api/inquiries").send(general)).status).toBe(429);

    await new Promise((resolve) => setTimeout(resolve, 350));

    expect((await request(app).post("/api/inquiries").send(general)).status).toBe(201);
  });

  it("does not limit the admin routes", async () => {
    const { app } = build({ limit: 1 });
    await request(app).post("/api/inquiries").send(general);
    await request(app).post("/api/inquiries").send(general);

    for (let i = 0; i < 3; i++) expect((await request(app).get("/api/inquiries").set(bearer(await adminToken()))).status).toBe(200);
  });
});

describe("POST /api/inquiries: signed in users", () => {
  it("keeps the user id from a good token", async () => {
    const { app, store } = build();
    const id = objectId();

    const res = await request(app).post("/api/inquiries").set(bearer(await userToken(id))).send(general);

    expect(res.status).toBe(201);
    expect(store.all()[0]).toMatchObject({ id: res.body.id, userId: id });
  });

  it("keeps the user id for a newsletter sign up too", async () => {
    const { app, store } = build();
    const id = objectId();

    await request(app).post("/api/inquiries").set(bearer(await userToken(id))).send({ category: "newsletter", email: "isabel@example.com" });

    expect(store.all()[0]).toMatchObject({ userId: id });
  });

  it("works without a token, with no user id", async () => {
    const { app, store } = build();

    await request(app).post("/api/inquiries").send(general);

    expect(store.all()[0]).not.toHaveProperty("userId");
  });

  it("does not turn a visitor away because their token is old or wrong: the message is saved without a user", async () => {
    const { app, store } = build();
    const expired = await new SignJWT({ role: "user" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(objectId())
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(env.JWT_SECRET));

    for (const token of ["not a token", expired]) {
      const res = await request(app).post("/api/inquiries").set(bearer(token)).send(general);
      expect(res.status).toBe(201);
    }

    expect(store.all()).toHaveLength(2);
    for (const saved of store.all()) expect(saved).not.toHaveProperty("userId");
  });

  it("ignores a token whose user id is not one we could have saved", async () => {
    const { app, store } = build();

    const res = await request(app).post("/api/inquiries").set(bearer(await userToken("not-an-object-id"))).send(general);

    expect(res.status).toBe(201);
    expect(store.all()[0]).not.toHaveProperty("userId");
  });
});

describe("POST /api/inquiries: newsletter duplicates", () => {
  it("answers 201 the same way for an address that is already subscribed, without a second record or email", async () => {
    const { app, store, mail } = build();

    const first = await request(app).post("/api/inquiries").send({ category: "newsletter", email: "isabel@example.com" });
    const second = await request(app).post("/api/inquiries").send({ category: "newsletter", email: "isabel@example.com" });

    expect(second.status).toBe(201);
    expect(second.body).toEqual(first.body);
    expect(store.all()).toHaveLength(1);
    expect(mail.sendNewsletterWelcome).toHaveBeenCalledTimes(1);
  });

  it("sees the same address in other capitals as the same one", async () => {
    const { app, store } = build();

    await request(app).post("/api/inquiries").send({ category: "newsletter", email: "isabel@example.com" });
    const again = await request(app).post("/api/inquiries").send({ category: "newsletter", email: "  ISABEL@Example.com " });

    expect(again.status).toBe(201);
    expect(store.all()).toHaveLength(1);
  });

  it("still lets the same address write messages, as many times as it likes", async () => {
    const { app, store } = build();

    await request(app).post("/api/inquiries").send({ category: "newsletter", email: "isabel@example.com" });
    await request(app).post("/api/inquiries").send(general);
    await request(app).post("/api/inquiries").send(general);

    expect(store.all()).toHaveLength(3);
  });
});

describe("GET /api/inquiries (admin)", () => {
  async function withInquiries() {
    const parts = build();
    const ids: string[] = [];
    for (const data of [
      { category: "general", name: "Ana", email: "ana@example.com", message: "A message from Ana" },
      { category: "wholesale", name: "Ben", email: "ben@example.com", message: "A message from Ben" },
      { category: "support", name: "Cy", email: "cy@example.com", message: "A message from Cy" },
      { category: "feedback", rating: 5 },
      { category: "newsletter", email: "dee@example.com" },
    ] as const) {
      ids.push((await parts.store.create(data)).id);
    }
    await parts.store.setStatus(ids[1], "responded");
    await parts.store.setStatus(ids[3], "responded");
    return { ...parts, ids };
  }

  it("answers 401 without a token and 403 for a user who is not an admin, in the standard shape", async () => {
    const { app } = await withInquiries();

    const anonymous = await request(app).get("/api/inquiries");
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.error.code).toBe("UNAUTHENTICATED");

    const user = await request(app).get("/api/inquiries").set(bearer(await userToken()));
    expect(user.status).toBe(403);
    expect(user.body.error).toEqual({ code: "FORBIDDEN", message: "You don't have access to that.", details: [] });
  });

  it("gives a page of inquiries, newest first, with the page, the limit and the total", async () => {
    const { app, ids } = await withInquiries();

    const res = await request(app).get("/api/inquiries").set(bearer(await adminToken()));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, limit: 20, total: 5 });
    expect(res.body.items.map((item: { id: string }) => item.id)).toEqual([...ids].reverse());
    expect(res.body.items[4]).toEqual({
      id: ids[0],
      category: "general",
      name: "Ana",
      email: "ana@example.com",
      message: "A message from Ana",
      status: "new",
      createdAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT/),
    });
  });

  it("filters by status", async () => {
    const { app, ids } = await withInquiries();

    const res = await request(app).get("/api/inquiries?status=responded").set(bearer(await adminToken()));

    expect(res.body.total).toBe(2);
    expect(res.body.items.map((item: { id: string }) => item.id)).toEqual([ids[3], ids[1]]);
  });

  it("filters by category", async () => {
    const { app, ids } = await withInquiries();

    const res = await request(app).get("/api/inquiries?category=newsletter").set(bearer(await adminToken()));

    expect(res.body.items.map((item: { id: string }) => item.id)).toEqual([ids[4]]);
  });

  it("filters by status and category together", async () => {
    const { app } = await withInquiries();
    const token = await adminToken();

    expect((await request(app).get("/api/inquiries?status=responded&category=wholesale").set(bearer(token))).body.total).toBe(1);
    expect((await request(app).get("/api/inquiries?status=new&category=wholesale").set(bearer(token))).body.total).toBe(0);
  });

  it("pages through the list", async () => {
    const { app, ids } = await withInquiries();
    const token = await adminToken();

    const first = await request(app).get("/api/inquiries?page=1&limit=2").set(bearer(token));
    const last = await request(app).get("/api/inquiries?page=3&limit=2").set(bearer(token));
    const beyond = await request(app).get("/api/inquiries?page=9&limit=2").set(bearer(token));

    expect(first.body).toMatchObject({ page: 1, limit: 2, total: 5 });
    expect(first.body.items.map((item: { id: string }) => item.id)).toEqual([ids[4], ids[3]]);
    expect(last.body.items.map((item: { id: string }) => item.id)).toEqual([ids[0]]);
    expect(beyond.body).toMatchObject({ items: [], page: 9, total: 5 });
  });

  it("answers 400 in the standard shape for filters that make no sense", async () => {
    const { app } = await withInquiries();
    const token = await adminToken();

    for (const [query, field] of [
      ["status=done", "status"],
      ["category=complaint", "category"],
      ["page=0", "page"],
      ["page=abc", "page"],
      ["limit=0", "limit"],
      ["limit=101", "limit"],
    ] as const) {
      const res = await request(app).get(`/api/inquiries?${query}`).set(bearer(token));
      expect(res.status, query).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.details[0].field).toBe(field);
    }
  });

  it("works for an empty list", async () => {
    const { app } = build();

    const res = await request(app).get("/api/inquiries").set(bearer(await adminToken()));

    expect(res.body).toEqual({ items: [], page: 1, limit: 20, total: 0 });
  });
});

describe("PATCH /api/inquiries/:id (admin)", () => {
  async function withOne() {
    const parts = build();
    const saved = await parts.store.create({ category: "general", name: "Ana", email: "ana@example.com", message: "A message from Ana" });
    return { ...parts, id: saved.id };
  }

  it("answers 401 without a token and 403 for a user who is not an admin", async () => {
    const { app, id } = await withOne();

    expect((await request(app).patch(`/api/inquiries/${id}`).send({ status: "responded" })).status).toBe(401);
    expect((await request(app).patch(`/api/inquiries/${id}`).set(bearer(await userToken())).send({ status: "responded" })).status).toBe(403);
  });

  it("marks an inquiry as responded, and back to new", async () => {
    const { app, store, id } = await withOne();
    const token = await adminToken();

    const responded = await request(app).patch(`/api/inquiries/${id}`).set(bearer(token)).send({ status: "responded" });
    expect(responded.status).toBe(200);
    expect(responded.body).toMatchObject({ id, status: "responded", name: "Ana", message: "A message from Ana" });
    expect(store.all()[0].status).toBe("responded");

    const again = await request(app).patch(`/api/inquiries/${id}`).set(bearer(token)).send({ status: "new" });
    expect(again.body.status).toBe("new");
  });

  it("answers 400 for a status that is not new or responded", async () => {
    const { app, store, id } = await withOne();

    for (const body of [{ status: "closed" }, { status: "" }, {}, { status: 1 }]) {
      const res = await request(app).patch(`/api/inquiries/${id}`).set(bearer(await adminToken())).send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error).toEqual({
        code: "VALIDATION_ERROR",
        message: "Status must be new or responded.",
        details: [{ field: "status", message: "Status must be new or responded." }],
      });
    }
    expect(store.all()[0].status).toBe("new");
  });

  it("changes nothing but the status", async () => {
    const { app, store, id } = await withOne();

    await request(app).patch(`/api/inquiries/${id}`).set(bearer(await adminToken())).send({ status: "responded", message: "changed", name: "Someone else", rating: 1 });

    expect(store.all()[0]).toMatchObject({ status: "responded", message: "A message from Ana", name: "Ana" });
    expect(store.all()[0]).not.toHaveProperty("rating");
  });

  it("answers 404 for an inquiry that does not exist", async () => {
    const { app } = await withOne();

    const res = await request(app).patch(`/api/inquiries/${objectId()}`).set(bearer(await adminToken())).send({ status: "responded" });

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: "NOT_FOUND", message: "That inquiry doesn't exist.", details: [] });
  });

  it("answers 400 for an id that is not an id", async () => {
    const { app } = await withOne();

    for (const id of ["123", "not-an-id", "..%2F..%2Fetc", "%7B%7D"]) {
      const res = await request(app).patch(`/api/inquiries/${id}`).set(bearer(await adminToken())).send({ status: "responded" });
      expect(res.status, id).toBe(400);
      expect(res.body.error.details[0].field).toBe("");
      expect(res.body.error.message).toBe("That isn't a valid inquiry id.");
    }
  });

  it("answers 401 before it looks at the id or the body", async () => {
    const { app } = await withOne();

    expect((await request(app).patch("/api/inquiries/not-an-id").send({ status: "nope" })).status).toBe(401);
  });
});

describe("when the database is down", () => {
  // what the MongoDB store throws when there is no connection
  const unavailable = () => Promise.reject(new AppError("DATABASE_UNAVAILABLE", 503, "We can't reach the database right now. Please try again in a moment."));

  it("answers 503 in the standard shape and sends no email", async () => {
    const { app, mail } = build({ store: { ...createMemoryInquiryStore(), create: unavailable } });

    const res = await request(app).post("/api/inquiries").send(general);

    expect(res.status).toBe(503);
    expect(res.body.error).toEqual({
      code: "DATABASE_UNAVAILABLE",
      message: "We can't reach the database right now. Please try again in a moment.",
      details: [],
    });
    expect(mail.sendInquiryEmail).not.toHaveBeenCalled();
  });

  it("answers 503 for a newsletter sign up and for the admin routes too", async () => {
    const down = { ...createMemoryInquiryStore(), findNewsletter: unavailable, list: unavailable, setStatus: unavailable };
    const { app, mail } = build({ store: down });
    const token = await adminToken();

    expect((await request(app).post("/api/inquiries").send({ category: "newsletter", email: "isabel@example.com" })).status).toBe(503);
    expect((await request(app).get("/api/inquiries").set(bearer(token))).status).toBe(503);
    expect((await request(app).patch(`/api/inquiries/${objectId()}`).set(bearer(token)).send({ status: "responded" })).status).toBe(503);
    expect(mail.sendNewsletterWelcome).not.toHaveBeenCalled();
  });
});
