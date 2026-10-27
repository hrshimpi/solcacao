import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import mongoose from "mongoose";
import { pino } from "pino";
import { pinoHttp } from "pino-http";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../errors/AppError.ts";
import { signToken } from "../middleware/auth.ts";
import { errorHandler } from "../middleware/errorHandler.ts";
import { createUpload } from "../middleware/upload.ts";
import { createB2BService } from "../services/b2b.service.ts";
import type { B2BRequestStore } from "../services/b2b.store.ts";
import type { UserProfile } from "../services/profile.service.ts";
import { createDiskStorage } from "../services/storage.service.ts";
import { createMemoryB2BStore } from "../test/memoryB2BStore.ts";
import { createB2BRouter, quoteRateLimiter } from "./b2b.routes.ts";

const pdf = Buffer.from("%PDF-1.7\nsome pdf content");
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("png content")]);
const postscript = Buffer.from("%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 10 10\n");

const objectId = () => new mongoose.Types.ObjectId().toString();
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const businessToken = (id = objectId()) => signToken({ id, role: "user", accountType: "b2b" });
const retailToken = (id = objectId()) => signToken({ id, role: "user", accountType: "retail" });

let base: string;

beforeEach(async () => {
  base = await mkdtemp(path.join(tmpdir(), "solcacao-quote-"));
});

afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

interface BuildOptions {
  limit?: number;
  maxFileBytes?: number;
  maxFiles?: number;
  store?: B2BRequestStore;
  profiles?: (userId: string) => Promise<UserProfile>;
}

// the routes with a store in memory, files in a temporary folder and a mail service that is only a spy
function build(options: BuildOptions = {}) {
  const memory = createMemoryB2BStore();
  const storage = createDiskStorage(path.join(base, "store"));
  const mail = { sendQuoteNotification: vi.fn(async () => true) };
  const service = createB2BService({
    store: options.store ?? memory,
    storage,
    mail,
    profiles: options.profiles ?? (async () => ({})),
  });
  const upload = createUpload({
    storage,
    tempDir: path.join(base, "tmp"),
    maxFileBytes: options.maxFileBytes ?? 1024 * 1024,
    maxFiles: options.maxFiles ?? 5,
    fieldName: "brandAssets",
  });

  const app = express();
  app.use(pinoHttp({ logger: pino({ level: "silent" }) }));
  app.use(express.json({ limit: "100kb" }));
  app.use("/api/b2b", createB2BRouter({ service, upload, limiter: quoteRateLimiter({ limit: options.limit }) }));
  app.use(errorHandler);

  return { app, store: memory, mail };
}

// every file anywhere under the test folder, as paths like "store/abc.pdf"
async function filesLeft() {
  const entries = await readdir(base, { recursive: true, withFileTypes: true }).catch(() => []);
  return entries.filter((entry) => entry.isFile()).map((entry) => path.relative(base, path.join(entry.parentPath, entry.name)).replaceAll("\\", "/"));
}

const fields = {
  cacaoProfile: "Ecuador",
  packagingType: "foil_wrap",
  quantityEstimate: "800",
  companyName: "Hacienda Brands",
  contactName: "Isabel Vasquez",
  notes: "Before the holidays, please.",
};

// a quote request form, with text fields and (maybe) files, signed in with a token
async function sendQuote(app: express.Express, options: { token?: string | null; fields?: Record<string, string | undefined>; files?: { name: string; type: string; content: Buffer; field?: string }[] } = {}) {
  const token = options.token === undefined ? await businessToken() : options.token;
  let call = request(app).post("/api/b2b/quote");
  if (token) call = call.set(bearer(token));
  for (const [name, value] of Object.entries(options.fields ?? fields)) {
    if (value !== undefined) call = call.field(name, value);
  }
  for (const file of options.files ?? []) {
    call = call.attach(file.field ?? "brandAssets", file.content, { filename: file.name, contentType: file.type });
  }
  return call;
}

const logo = { name: "logo.png", type: "image/png", content: png };
const guide = { name: "brand-guide.pdf", type: "application/pdf", content: pdf };

describe("POST /api/b2b/quote: who may send one", () => {
  it("answers 401 to a guest, in the standard shape, and stores nothing", async () => {
    const { app, store, mail } = build();

    const res = await sendQuote(app, { token: null, files: [logo] });

    expect(res.status).toBe(401);
    expect(res.body.error).toEqual({ code: "UNAUTHENTICATED", message: "Please sign in to do that.", details: [] });
    expect(store.all()).toEqual([]);
    expect(mail.sendQuoteNotification).not.toHaveBeenCalled();
    expect(await filesLeft()).toEqual([]);
  });

  it("answers 401 for a token that is not good", async () => {
    const { app } = build();

    for (const token of ["not a token", "a.b.c"]) {
      expect((await sendQuote(app, { token })).status).toBe(401);
    }
  });

  it("answers 403 to a retail account, in the standard shape, and stores nothing", async () => {
    const { app, store, mail } = build();

    const res = await sendQuote(app, { token: await retailToken(), files: [logo, guide] });

    expect(res.status).toBe(403);
    expect(res.body.error).toEqual({ code: "FORBIDDEN", message: "You don't have access to that.", details: [] });
    expect(store.all()).toEqual([]);
    expect(mail.sendQuoteNotification).not.toHaveBeenCalled();
    expect(await filesLeft()).toEqual([]);
  });

  it("answers 403 to an admin who has no business account", async () => {
    const { app } = build();

    const res = await sendQuote(app, { token: await signToken({ id: objectId(), role: "admin" }) });

    expect(res.status).toBe(403);
  });

  it("answers 401 when the token has an id we cannot save, and stores nothing", async () => {
    const { app, store } = build();

    const res = await sendQuote(app, { token: await businessToken("not-an-object-id"), files: [logo] });

    expect(res.status).toBe(401);
    expect(store.all()).toEqual([]);
    expect(await filesLeft()).toEqual([]);
  });
});

describe("POST /api/b2b/quote: a valid request", () => {
  it("answers 201 { request } for a request without files", async () => {
    const { app, store } = build();
    const id = objectId();

    const res = await sendQuote(app, { token: await businessToken(id) });

    expect(res.status).toBe(201);
    expect(Object.keys(res.body)).toEqual(["request"]);
    expect(res.body.request).toEqual({
      id: expect.stringMatching(/^[0-9a-f]{24}$/),
      userId: id,
      companyName: "Hacienda Brands",
      contactName: "Isabel Vasquez",
      cacaoProfile: "Ecuador",
      packagingType: "foil_wrap",
      quantityEstimate: 800,
      notes: "Before the holidays, please.",
      brandAssets: [],
      status: "submitted",
      quoteAmount: null,
      createdAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT/),
      updatedAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT/),
    });
    expect(store.all()).toEqual([res.body.request]);
  });

  it("answers 201 for a request with files, and keeps the files", async () => {
    const { app } = build();

    const res = await sendQuote(app, { files: [logo, guide, { name: "label.eps", type: "application/postscript", content: postscript }] });

    expect(res.status).toBe(201);
    const assets = res.body.request.brandAssets;
    expect(assets.map((asset: { originalName: string }) => asset.originalName)).toEqual(["logo.png", "brand-guide.pdf", "label.eps"]);
    for (const asset of assets) {
      expect(asset.storedName).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|pdf|eps)$/);
      expect(asset.uploadedAt).toMatch(/^\d{4}-\d\d-\d\dT/);
      expect(Object.keys(asset).sort()).toEqual(["mimeType", "originalName", "sizeBytes", "storedName", "uploadedAt"]);
    }
    expect(assets[0]).toMatchObject({ mimeType: "image/png", sizeBytes: png.length });
    expect((await filesLeft()).sort()).toEqual(assets.map((asset: { storedName: string }) => `store/${asset.storedName}`).sort());
  });

  it("accepts the largest number of files", async () => {
    const { app } = build();

    const res = await sendQuote(app, { files: Array.from({ length: 5 }, (_, i) => ({ name: `file-${i}.pdf`, type: "application/pdf", content: pdf })) });

    expect(res.status).toBe(201);
    expect(res.body.request.brandAssets).toHaveLength(5);
  });

  it("can only be set by the form's own fields: status, quote and user cannot be chosen", async () => {
    const { app } = build();
    const id = objectId();

    const res = await sendQuote(app, {
      token: await businessToken(id),
      fields: { ...fields, status: "approved", quoteAmount: "1", quoteNote: "free", userId: objectId(), id: "mine" },
    });

    expect(res.status).toBe(201);
    expect(res.body.request).toMatchObject({ status: "submitted", quoteAmount: null, userId: id });
    expect(res.body.request).not.toHaveProperty("quoteNote");
    expect(res.body.request.id).not.toBe("mine");
  });

  it("strips HTML from the text", async () => {
    const { app } = build();

    const res = await sendQuote(app, { fields: { ...fields, companyName: "<b>Hacienda</b> Brands", notes: "Hello <script>alert(1)</script>there" } });

    expect(res.status).toBe(201);
    expect(res.body.request).toMatchObject({ companyName: "Hacienda Brands", notes: "Hello there" });
  });

  it("works without notes", async () => {
    const { app } = build();

    const res = await sendQuote(app, { fields: { ...fields, notes: undefined } });

    expect(res.status).toBe(201);
    expect(res.body.request).not.toHaveProperty("notes");
  });

  it("also takes a JSON body when there are no files", async () => {
    const { app } = build();

    const res = await request(app)
      .post("/api/b2b/quote")
      .set(bearer(await businessToken()))
      .send({ ...fields, quantityEstimate: 800 });

    expect(res.status).toBe(201);
  });

  it("tells the team about it, with the customer's address", async () => {
    const { app, mail } = build({ profiles: async () => ({ email: "buyer@hotel.example", name: "Isabel Vasquez" }) });

    const res = await sendQuote(app, { files: [logo] });

    expect(mail.sendQuoteNotification).toHaveBeenCalledTimes(1);
    expect(mail.sendQuoteNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        companyName: "Hacienda Brands",
        contactName: "Isabel Vasquez",
        cacaoProfile: "Ecuador",
        packagingType: "foil_wrap",
        quantityEstimate: 800,
        notes: "Before the holidays, please.",
        brandAssets: [expect.objectContaining({ originalName: "logo.png", sizeBytes: png.length })],
      }),
      { email: "buyer@hotel.example", name: "Isabel Vasquez" },
    );
    expect(res.status).toBe(201);
  });
});

describe("POST /api/b2b/quote: company and contact from the profile", () => {
  const profile = { email: "buyer@hotel.example", name: "Profile Person", companyName: "Profile Company" };

  it("uses the profile when the fields are missing or empty", async () => {
    const { app } = build({ profiles: async () => profile });

    for (const missing of [{ companyName: undefined, contactName: undefined }, { companyName: "", contactName: "   " }]) {
      const res = await sendQuote(app, { fields: { ...fields, ...missing } });
      expect(res.status).toBe(201);
      expect(res.body.request).toMatchObject({ companyName: "Profile Company", contactName: "Profile Person" });
    }
  });

  it("uses the form over the profile when the form has them", async () => {
    const { app } = build({ profiles: async () => profile });

    const res = await sendQuote(app, { fields: { ...fields, companyName: "Form Company" } });

    expect(res.body.request).toMatchObject({ companyName: "Form Company", contactName: "Isabel Vasquez" });
  });

  it("fills in only the one that is missing", async () => {
    const { app } = build({ profiles: async () => profile });

    const res = await sendQuote(app, { fields: { ...fields, contactName: undefined } });

    expect(res.body.request).toMatchObject({ companyName: "Hacienda Brands", contactName: "Profile Person" });
  });

  it("asks for them when neither the form nor the profile has them", async () => {
    const { app, store } = build({ profiles: async () => ({}) });

    const res = await sendQuote(app, { fields: { ...fields, companyName: undefined, contactName: undefined } });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { field: "companyName", message: "Please enter your company name." },
      { field: "contactName", message: "Please enter the name of the contact person." },
    ]);
    expect(store.all()).toEqual([]);
  });

  it("still works when the profile cannot be read", async () => {
    const { app } = build({ profiles: async () => Promise.reject(new Error("users collection is gone")) });

    expect((await sendQuote(app)).status).toBe(201);
    expect((await sendQuote(app, { fields: { ...fields, companyName: undefined } })).status).toBe(400);
  });
});

describe("POST /api/b2b/quote: fields that are not valid", () => {
  it("answers 400 in the standard shape, naming every field that is wrong", async () => {
    const { app, store, mail } = build();

    const res = await sendQuote(app, { fields: {} });

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: "VALIDATION_ERROR",
      message: "Please choose a cacao profile.",
      details: [
        { field: "cacaoProfile", message: "Please choose a cacao profile." },
        { field: "packagingType", message: "Please choose a packaging option: foil_wrap, rigid_box, specimen_card or paper_sleeve." },
        { field: "quantityEstimate", message: "Please enter how many units you need, as a whole number." },
        { field: "companyName", message: "Please enter your company name." },
        { field: "contactName", message: "Please enter the name of the contact person." },
      ],
    });
    expect(store.all()).toEqual([]);
    expect(mail.sendQuoteNotification).not.toHaveBeenCalled();
  });

  it.each([
    [{ packagingType: "gift_bag" }, "packagingType"],
    [{ quantityEstimate: "0" }, "quantityEstimate"],
    [{ quantityEstimate: "-4" }, "quantityEstimate"],
    [{ quantityEstimate: "2.5" }, "quantityEstimate"],
    [{ quantityEstimate: "lots" }, "quantityEstimate"],
    [{ companyName: "A" }, "companyName"],
    [{ companyName: "a".repeat(81) }, "companyName"],
    [{ contactName: "a".repeat(81) }, "contactName"],
    [{ cacaoProfile: "a".repeat(61) }, "cacaoProfile"],
    [{ notes: "a".repeat(2001) }, "notes"],
  ])("refuses %j", async (change, field) => {
    const { app, store } = build();

    const res = await sendQuote(app, { fields: { ...fields, ...change } });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.map((detail: { field: string }) => detail.field)).toEqual([field]);
    expect(store.all()).toEqual([]);
  });
});

describe("POST /api/b2b/quote: files that are not valid", () => {
  it("answers 400 for a file type that is not allowed, and stores nothing", async () => {
    const { app, store, mail } = build();

    const res = await sendQuote(app, { files: [logo, { name: "notes.txt", type: "text/plain", content: Buffer.from("hello there") }] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("UNSUPPORTED_FILE_TYPE");
    expect(res.body.error.message).toBe(`"notes.txt" isn't a supported file. Use PDF, AI, EPS or PNG.`);
    expect(store.all()).toEqual([]);
    expect(mail.sendQuoteNotification).not.toHaveBeenCalled();
    expect(await filesLeft()).toEqual([]);
  });

  it("answers 400 for a file that is not what its name says", async () => {
    const { app } = build();

    const res = await sendQuote(app, { files: [guide, { name: "fake.png", type: "image/png", content: Buffer.from("<html>not a picture</html>") }] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("FILE_CONTENT_MISMATCH");
    expect(res.body.error.details).toEqual([{ file: "fake.png", code: "FILE_CONTENT_MISMATCH", message: `"fake.png" doesn't look like a real PNG file.` }]);
    expect(await filesLeft()).toEqual([]);
  });

  it("answers 413 for a file that is too big", async () => {
    const { app, store } = build({ maxFileBytes: 1024 });

    const res = await sendQuote(app, { files: [{ name: "big.png", type: "image/png", content: Buffer.concat([png, Buffer.alloc(3000)]) }] });

    expect(res.status).toBe(413);
    expect(res.body.error).toEqual({ code: "FILE_TOO_LARGE", message: "That file is too big. Each file can be up to 1 KB.", details: [] });
    expect(store.all()).toEqual([]);
    expect(await filesLeft()).toEqual([]);
  });

  it("answers 400 for too many files", async () => {
    const { app, store } = build({ maxFiles: 2 });

    const res = await sendQuote(app, { files: [guide, guide, guide] });

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({ code: "TOO_MANY_FILES", message: "Too many files. You can upload up to 2 at a time.", details: [] });
    expect(store.all()).toEqual([]);
    expect(await filesLeft()).toEqual([]);
  });

  it("answers 400 for six files with the real limit of five", async () => {
    const { app } = build();

    const res = await sendQuote(app, { files: Array.from({ length: 6 }, (_, i) => ({ name: `file-${i}.pdf`, type: "application/pdf", content: pdf })) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("TOO_MANY_FILES");
    expect(await filesLeft()).toEqual([]);
  });

  it("answers 400 for files sent in the wrong field", async () => {
    const { app } = build();

    const res = await sendQuote(app, { files: [{ ...logo, field: "attachments" }] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("UNEXPECTED_FILE_FIELD");
    expect(await filesLeft()).toEqual([]);
  });
});

describe("POST /api/b2b/quote: cleaning up when something fails", () => {
  it("deletes the stored files when the text fields are not valid", async () => {
    const { app, store } = build();

    const res = await sendQuote(app, { fields: { ...fields, quantityEstimate: "0" }, files: [logo, guide] });

    expect(res.status).toBe(400);
    expect(store.all()).toEqual([]);
    // no waiting: the files are gone before the answer is sent
    expect(await filesLeft()).toEqual([]);
  });

  it("deletes the stored files when the company and contact are missing everywhere", async () => {
    const { app } = build();

    const res = await sendQuote(app, { fields: { ...fields, companyName: undefined }, files: [guide] });

    expect(res.status).toBe(400);
    expect(await filesLeft()).toEqual([]);
  });

  it("deletes the stored files when saving the request fails", async () => {
    const failing: B2BRequestStore = { create: async () => Promise.reject(new AppError("DATABASE_UNAVAILABLE", 503, "We can't reach the database right now. Please try again in a moment.")) };
    const { app, mail } = build({ store: failing });

    const res = await sendQuote(app, { files: [logo, guide] });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("DATABASE_UNAVAILABLE");
    expect(await filesLeft()).toEqual([]);
    expect(mail.sendQuoteNotification).not.toHaveBeenCalled();
  });

  it("deletes the stored files when saving fails in an unexpected way", async () => {
    const failing: B2BRequestStore = { create: async () => Promise.reject(new Error("disk full")) };
    const { app } = build({ store: failing });

    const res = await sendQuote(app, { files: [logo] });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(await filesLeft()).toEqual([]);
  });

  it("keeps the files of a request that worked", async () => {
    const { app } = build();

    await sendQuote(app, { files: [logo, guide] });
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect((await filesLeft()).filter((file) => file.startsWith("store/"))).toHaveLength(2);
    expect((await filesLeft()).filter((file) => file.startsWith("tmp/"))).toEqual([]);
  });
});

describe("POST /api/b2b/quote: the email never fails the request", () => {
  it.each([
    ["returns false", async () => false],
    ["rejects", async () => Promise.reject(new Error("smtp is down"))],
    [
      "throws",
      () => {
        throw new Error("broken");
      },
    ],
  ])("when the mail service %s", async (_label, send) => {
    const { app, store, mail } = build();
    mail.sendQuoteNotification.mockImplementation(send as never);

    const res = await sendQuote(app, { files: [logo] });

    expect(res.status).toBe(201);
    expect(store.all()).toHaveLength(1);
    expect((await filesLeft()).filter((file) => file.startsWith("store/"))).toHaveLength(1);
  });
});

describe("POST /api/b2b/quote: 10 requests per hour for each user", () => {
  it("answers 429 to the 11th request, in the standard shape", async () => {
    const { app, store } = build();
    const token = await businessToken();

    for (let i = 1; i <= 10; i++) expect((await sendQuote(app, { token })).status, `request ${i}`).toBe(201);
    const eleventh = await sendQuote(app, { token });

    expect(eleventh.status).toBe(429);
    expect(eleventh.body.error).toEqual({
      code: "RATE_LIMITED",
      message: "You have sent a lot of quote requests. Please try again in an hour.",
      details: [],
    });
    expect(Number(eleventh.headers["retry-after"])).toBeGreaterThan(0);
    expect(Number(eleventh.headers["retry-after"])).toBeLessThanOrEqual(3600);
    expect(store.all()).toHaveLength(10);
  });

  it("counts each user on their own", async () => {
    const { app } = build({ limit: 2 });
    const anna = await businessToken();
    const ben = await businessToken();

    for (let i = 0; i < 2; i++) await sendQuote(app, { token: anna });

    expect((await sendQuote(app, { token: anna })).status).toBe(429);
    expect((await sendQuote(app, { token: ben })).status).toBe(201);
  });

  it("counts every request of a user, also the ones that were refused", async () => {
    const { app } = build({ limit: 3 });
    const token = await businessToken();

    for (let i = 0; i < 3; i++) expect((await sendQuote(app, { token, fields: {} })).status).toBe(400);

    expect((await sendQuote(app, { token })).status).toBe(429);
  });

  it("is used before the files are read: a user over the limit stores nothing", async () => {
    const { app, store } = build({ limit: 1 });
    const token = await businessToken();
    await sendQuote(app, { token });
    const filesBefore = await filesLeft();

    const res = await sendQuote(app, { token, files: [logo, guide] });

    expect(res.status).toBe(429);
    expect(store.all()).toHaveLength(1);
    expect(await filesLeft()).toEqual(filesBefore);
  });

  it("does not count guests or retail accounts, they are turned away first", async () => {
    const { app } = build({ limit: 1 });
    const retail = await retailToken();

    for (let i = 0; i < 3; i++) expect((await sendQuote(app, { token: retail })).status).toBe(403);
    for (let i = 0; i < 3; i++) expect((await sendQuote(app, { token: null })).status).toBe(401);

    expect((await sendQuote(app)).status).toBe(201);
  });
});
