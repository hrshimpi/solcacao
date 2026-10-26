// The routes for reading and changing quote requests: /api/b2b/requests. They run on a store in memory and
// real files in a temporary folder, with the real auth and error handling, so every answer is the one a
// client gets. Sending quote requests (POST /quote) is tested in b2b.routes.test.ts.
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import express, { type RequestHandler } from "express";
import mongoose from "mongoose";
import { pino } from "pino";
import { pinoHttp } from "pino-http";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { signToken } from "../middleware/auth.ts";
import { errorHandler } from "../middleware/errorHandler.ts";
import type { StoredUpload } from "../middleware/upload.ts";
import { requestStatuses, type RequestStatus } from "../models/b2b-request.model.ts";
import { createB2BService } from "../services/b2b.service.ts";
import type { B2BRequestStore, NewB2BRequest } from "../services/b2b.store.ts";
import { createDiskStorage, type StorageService } from "../services/storage.service.ts";
import { createMemoryB2BStore, requestInStatus } from "../test/memoryB2BStore.ts";
import { createB2BRouter } from "./b2b.routes.ts";

const objectId = () => new mongoose.Types.ObjectId().toString();
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const businessToken = (id: string) => signToken({ id, role: "user", accountType: "b2b" });
const retailToken = (id: string) => signToken({ id, role: "user", accountType: "retail" });
const adminToken = (id = objectId()) => signToken({ id, role: "admin" });

const unauthenticated = { code: "UNAUTHENTICATED", message: "Please sign in to do that.", details: [] };
const forbidden = { code: "FORBIDDEN", message: "You don't have access to that.", details: [] };
const notFound = { code: "NOT_FOUND", message: "We couldn't find that request.", details: [] };

// the users of the tests
const isabel = objectId();
const marco = objectId();

let base: string;

beforeEach(async () => {
  base = await mkdtemp(path.join(tmpdir(), "solcacao-requests-"));
});

afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

// the routes with a store in memory and files in a temporary folder. Uploading and the limit are tested with
// the quote itself, so they are left out here.
function build(options: { store?: B2BRequestStore } = {}) {
  const memory = createMemoryB2BStore();
  const storage = createDiskStorage(path.join(base, "store"));
  const service = createB2BService({ store: options.store ?? memory, storage, mail: { sendQuoteNotification: async () => true }, profiles: async () => ({}) });
  const letThrough: RequestHandler = (_req, _res, next) => next();

  const app = express();
  app.use(pinoHttp({ logger: pino({ level: "silent" }) }));
  app.use(express.json({ limit: "100kb" }));
  app.use("/api/b2b", createB2BRouter({ service, upload: letThrough, limiter: letThrough }));
  app.use(errorHandler);

  return { app, store: memory, storage };
}

interface FileToStore {
  name: string;
  type: string;
  content: Buffer;
}

const pdf: FileToStore = { name: "brand-guide.pdf", type: "application/pdf", content: Buffer.from("%PDF-1.7\nthe brand guide") };
const png: FileToStore = { name: "logo.png", type: "image/png", content: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), randomBytes(2000)]) };

// puts a file in the storage, and returns it the way a request keeps it
async function storeFile(storage: StorageService, file: FileToStore): Promise<StoredUpload> {
  const tempPath = path.join(base, `waiting-${randomUUID()}`);
  await writeFile(tempPath, file.content);
  const { storedName } = await storage.save({ tempPath, extension: path.extname(file.name).toLowerCase(), mimeType: file.type });
  return { originalName: file.name, storedName, mimeType: file.type, sizeBytes: file.content.length };
}

async function newRequest(storage: StorageService, userId: string, files: FileToStore[] = [], overrides: Partial<NewB2BRequest> = {}): Promise<NewB2BRequest> {
  const brandAssets = await Promise.all(files.map((file) => storeFile(storage, file)));
  return {
    userId,
    companyName: "Hacienda Brands",
    contactName: "Isabel Vasquez",
    cacaoProfile: "Ecuador",
    packagingType: "foil_wrap",
    quantityEstimate: 800,
    notes: "Before the holidays, please.",
    brandAssets,
    ...overrides,
  };
}

// a request of the given user, in the given status, with the given files
async function seed(ctx: ReturnType<typeof build>, userId: string, options: { status?: RequestStatus; files?: FileToStore[] } = {}) {
  return requestInStatus(ctx.store, options.status ?? "submitted", await newRequest(ctx.storage, userId, options.files));
}

function get(app: express.Express, url: string, token?: string) {
  const call = request(app).get(url);
  return token ? call.set(bearer(token)) : call;
}

function patch(app: express.Express, id: string, body: unknown, token?: string) {
  const call = request(app).patch(`/api/b2b/requests/${id}`);
  return (token ? call.set(bearer(token)) : call).send(body as object);
}

// a download: the body is the bytes of the file, or the parsed error when the answer is JSON
function download(app: express.Express, url: string, token?: string) {
  return get(app, url, token)
    .buffer(true)
    .parse((res, done) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const bytes = Buffer.concat(chunks);
        done(null, String(res.headers["content-type"]).includes("json") ? JSON.parse(bytes.toString("utf8")) : bytes);
      });
    });
}

const assetUrl = (requestId: string, storedName: string) => `/api/b2b/requests/${requestId}/assets/${storedName}`;

describe("GET /api/b2b/requests: who may ask", () => {
  it("answers 401 to a guest, in the standard shape", async () => {
    const { app } = build();

    const res = await get(app, "/api/b2b/requests");

    expect(res.status).toBe(401);
    expect(res.body.error).toEqual(unauthenticated);
  });

  it("answers 401 for a token that is not good, and for an id that cannot be a user", async () => {
    const { app } = build();

    expect((await get(app, "/api/b2b/requests", "not a token")).status).toBe(401);
    expect((await get(app, "/api/b2b/requests", await businessToken("not-an-id"))).status).toBe(401);
  });

  it("answers 403 to a retail account", async () => {
    const { app } = build();

    const res = await get(app, "/api/b2b/requests", await retailToken(isabel));

    expect(res.status).toBe(403);
    expect(res.body.error).toEqual(forbidden);
  });

  it("answers 403 to an admin who has no business account", async () => {
    const { app } = build();

    expect((await get(app, "/api/b2b/requests", await adminToken())).status).toBe(403);
  });
});

describe("GET /api/b2b/requests: the list", () => {
  it("gives the user's requests, newest first, in pages", async () => {
    const ctx = build();
    const first = await seed(ctx, isabel);
    const second = await seed(ctx, isabel, { status: "quoted" });
    const third = await seed(ctx, isabel, { files: [pdf, png] });

    const res = await get(ctx.app, "/api/b2b/requests", await businessToken(isabel));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [third, second, first], page: 1, limit: 20, total: 3, totalPages: 1 });
  });

  it("never lists the requests of other users", async () => {
    const ctx = build();
    const mine = await seed(ctx, isabel);
    await seed(ctx, marco);
    await seed(ctx, marco, { status: "quoted" });

    const res = await get(ctx.app, "/api/b2b/requests", await businessToken(isabel));

    expect(res.body.items.map((item: { id: string }) => item.id)).toEqual([mine.id]);
    expect(res.body.total).toBe(1);
  });

  it("does not let the address ask for another user's requests", async () => {
    const ctx = build();
    await seed(ctx, marco);

    const res = await get(ctx.app, `/api/b2b/requests?userId=${marco}`, await businessToken(isabel));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ items: [], total: 0 });
  });

  it("pages through the list", async () => {
    const ctx = build();
    const saved = [];
    for (let i = 0; i < 5; i++) saved.push(await seed(ctx, isabel));
    const newestFirst = saved.map((item) => item.id).reverse();
    const token = await businessToken(isabel);

    const second = await get(ctx.app, "/api/b2b/requests?page=2&limit=2", token);
    const last = await get(ctx.app, "/api/b2b/requests?page=3&limit=2", token);

    expect(second.body).toMatchObject({ page: 2, limit: 2, total: 5, totalPages: 3 });
    expect(second.body.items.map((item: { id: string }) => item.id)).toEqual(newestFirst.slice(2, 4));
    expect(last.body.items.map((item: { id: string }) => item.id)).toEqual(newestFirst.slice(4));
  });

  it("answers an empty page after the last one", async () => {
    const ctx = build();
    await seed(ctx, isabel);

    const res = await get(ctx.app, "/api/b2b/requests?page=5", await businessToken(isabel));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], page: 5, limit: 20, total: 1, totalPages: 1 });
  });

  it("answers an empty list for a user who has not sent anything", async () => {
    const { app } = build();

    const res = await get(app, "/api/b2b/requests", await businessToken(isabel));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 });
  });

  it("answers 400 in the standard shape for a page or a limit that is not valid", async () => {
    const { app } = build();
    const token = await businessToken(isabel);

    for (const [query, field, message] of [
      ["page=0", "page", "page starts at 1."],
      ["page=abc", "page", "page must be a number."],
      ["limit=0", "limit", "limit must be at least 1."],
      ["limit=101", "limit", "limit can be at most 100."],
      ["limit=2.5", "limit", "limit must be a whole number."],
    ]) {
      const res = await get(app, `/api/b2b/requests?${query}`, token);

      expect(res.status, query).toBe(400);
      expect(res.body.error).toEqual({ code: "VALIDATION_ERROR", message, details: [{ field, message }] });
    }
  });

  it("shows the files of a request by name, with no address and no place on the disk", async () => {
    const ctx = build();
    const saved = await seed(ctx, isabel, { files: [pdf] });

    const res = await get(ctx.app, "/api/b2b/requests", await businessToken(isabel));

    expect(res.body.items[0].brandAssets).toEqual([
      { originalName: "brand-guide.pdf", storedName: saved.brandAssets[0].storedName, mimeType: "application/pdf", sizeBytes: pdf.content.length, uploadedAt: expect.any(String) },
    ]);
    expect(JSON.stringify(res.body)).not.toContain("http");
    expect(JSON.stringify(res.body)).not.toContain(base);
  });
});

describe("GET /api/b2b/requests/:id", () => {
  it("answers 401 to a guest", async () => {
    const ctx = build();
    const saved = await seed(ctx, isabel);

    const res = await get(ctx.app, `/api/b2b/requests/${saved.id}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toEqual(unauthenticated);
  });

  it("gives a request to its owner, with the quote once there is one", async () => {
    const ctx = build();
    const saved = await seed(ctx, isabel, { status: "quoted", files: [png] });

    const res = await get(ctx.app, `/api/b2b/requests/${saved.id}`, await businessToken(isabel));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ request: saved });
    expect(res.body.request).toMatchObject({ status: "quoted", quoteAmount: 5000, quoteNote: "Valid for 30 days." });
  });

  it("gives any request to an admin", async () => {
    const ctx = build();
    const saved = await seed(ctx, isabel);

    const res = await get(ctx.app, `/api/b2b/requests/${saved.id}`, await adminToken());

    expect(res.status).toBe(200);
    expect(res.body.request).toEqual(saved);
  });

  it("answers 404 to another business user, and to a retail account", async () => {
    const ctx = build();
    const saved = await seed(ctx, isabel);

    for (const token of [await businessToken(marco), await retailToken(marco)]) {
      const res = await get(ctx.app, `/api/b2b/requests/${saved.id}`, token);

      expect(res.status).toBe(404);
      expect(res.body.error).toEqual(notFound);
    }
  });

  it("answers the same 404 for a request that is not there, so ids cannot be tried out", async () => {
    const ctx = build();
    const saved = await seed(ctx, isabel);
    const token = await businessToken(marco);

    const someoneElses = await get(ctx.app, `/api/b2b/requests/${saved.id}`, token);
    const missing = await get(ctx.app, `/api/b2b/requests/${objectId()}`, token);

    expect(missing.status).toBe(404);
    expect(missing.body).toEqual(someoneElses.body);
  });

  it("answers 404 to an admin for a request that is not there", async () => {
    const { app } = build();

    const res = await get(app, `/api/b2b/requests/${objectId()}`, await adminToken());

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual(notFound);
  });

  it("answers 400 for an id that cannot be a request id", async () => {
    const { app } = build();

    for (const id of ["abc", "123", "64b7f0c2a1b2c3d4e5f6071g", "%7B%24ne%3A%20null%7D"]) {
      const res = await get(app, `/api/b2b/requests/${id}`, await businessToken(isabel));

      expect(res.status, id).toBe(400);
      expect(res.body.error).toMatchObject({ code: "VALIDATION_ERROR", message: "That isn't a valid request id." });
    }
  });
});

describe("GET /api/b2b/requests/:id/assets/:storedName", () => {
  it("answers 401 to a guest, and sends no file", async () => {
    const ctx = build();
    const saved = await seed(ctx, isabel, { files: [pdf] });

    const res = await download(ctx.app, assetUrl(saved.id, saved.brandAssets[0].storedName));

    expect(res.status).toBe(401);
    expect(res.body.error).toEqual(unauthenticated);
    expect(res.headers["content-disposition"]).toBeUndefined();
  });

  it("gives the file to the owner, as a download with the name it was uploaded with", async () => {
    const ctx = build();
    const saved = await seed(ctx, isabel, { files: [pdf, png] });

    const res = await download(ctx.app, assetUrl(saved.id, saved.brandAssets[0].storedName), await businessToken(isabel));

    expect(res.status).toBe(200);
    expect(res.body).toEqual(pdf.content);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-disposition"]).toBe('attachment; filename="brand-guide.pdf"');
  });

  it("gives each file with its own type and name", async () => {
    const ctx = build();
    const saved = await seed(ctx, isabel, { files: [pdf, png] });
    const token = await businessToken(isabel);

    const image = await download(ctx.app, assetUrl(saved.id, saved.brandAssets[1].storedName), token);

    expect(image.status).toBe(200);
    expect(image.body).toEqual(png.content);
    expect(image.headers["content-type"]).toBe("image/png");
    expect(image.headers["content-disposition"]).toBe('attachment; filename="logo.png"');
  });

  it("is never inline, never sniffed and never kept by a cache", async () => {
    const ctx = build();
    const saved = await seed(ctx, isabel, { files: [pdf] });

    const res = await download(ctx.app, assetUrl(saved.id, saved.brandAssets[0].storedName), await businessToken(isabel));

    expect(res.headers["content-disposition"]).toMatch(/^attachment/);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["cache-control"]).toBe("private, no-store");
  });

  it("writes a file name with spaces, quotes and accents so it cannot break out of the header", async () => {
    const ctx = build();
    const saved = await seed(ctx, isabel, { files: [{ ...pdf, name: 'Café "Q4" guide.pdf' }] });

    const res = await download(ctx.app, assetUrl(saved.id, saved.brandAssets[0].storedName), await businessToken(isabel));

    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toBe('attachment; filename="Café \\"Q4\\" guide.pdf"');
  });

  it("also sends the real name of a file with letters that old headers cannot hold", async () => {
    const ctx = build();
    const saved = await seed(ctx, isabel, { files: [{ ...pdf, name: "Q4 日本.pdf" }] });

    const res = await download(ctx.app, assetUrl(saved.id, saved.brandAssets[0].storedName), await businessToken(isabel));

    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toBe(`attachment; filename="Q4 ??.pdf"; filename*=UTF-8''Q4%20%E6%97%A5%E6%9C%AC.pdf`);
  });

  it("sends a file of a few hundred kilobytes without changing a byte", async () => {
    const ctx = build();
    const big = { name: "big.png", type: "image/png", content: Buffer.concat([png.content.subarray(0, 8), randomBytes(600_000)]) };
    const saved = await seed(ctx, isabel, { files: [big] });

    const res = await download(ctx.app, assetUrl(saved.id, saved.brandAssets[0].storedName), await businessToken(isabel));

    expect(res.status).toBe(200);
    expect(res.body.equals(big.content)).toBe(true);
  });

  it("gives the file to an admin, for any request", async () => {
    const ctx = build();
    const saved = await seed(ctx, isabel, { files: [pdf] });

    const res = await download(ctx.app, assetUrl(saved.id, saved.brandAssets[0].storedName), await adminToken());

    expect(res.status).toBe(200);
    expect(res.body).toEqual(pdf.content);
    expect(res.headers["content-disposition"]).toBe('attachment; filename="brand-guide.pdf"');
  });

  it("answers 404 to another business user and to a retail account, with no file", async () => {
    const ctx = build();
    const saved = await seed(ctx, isabel, { files: [pdf] });

    for (const token of [await businessToken(marco), await retailToken(marco)]) {
      const res = await download(ctx.app, assetUrl(saved.id, saved.brandAssets[0].storedName), token);

      expect(res.status).toBe(404);
      expect(res.body.error).toEqual(notFound);
      expect(res.headers["content-disposition"]).toBeUndefined();
    }
  });

  it("does not give a file through a request that does not own it", async () => {
    const ctx = build();
    const mine = await seed(ctx, isabel, { files: [pdf] });
    const theirs = await seed(ctx, marco, { files: [png] });

    // isabel owns her request, but the file belongs to marco's
    const res = await download(ctx.app, assetUrl(mine.id, theirs.brandAssets[0].storedName), await businessToken(isabel));
    // an admin sees both requests, but a file is still only reached through its own request
    const asAdmin = await download(ctx.app, assetUrl(mine.id, theirs.brandAssets[0].storedName), await adminToken());

    for (const answer of [res, asAdmin]) {
      expect(answer.status).toBe(404);
      expect(answer.body.error.code).toBe("FILE_NOT_FOUND");
      expect(answer.headers["content-disposition"]).toBeUndefined();
    }
  });

  it("answers 404 for a file name the request does not have", async () => {
    const ctx = build();
    const saved = await seed(ctx, isabel, { files: [pdf] });
    const token = await businessToken(isabel);

    for (const name of ["nothing.pdf", "11111111-2222-3333-4444-555555555555.pdf", "brand-guide.pdf", saved.brandAssets[0].storedName.toUpperCase()]) {
      const res = await download(ctx.app, assetUrl(saved.id, name), token);

      expect(res.status, name).toBe(404);
      expect(res.body.error).toEqual({ code: "FILE_NOT_FOUND", message: "That file doesn't exist.", details: [] });
    }
  });

  it("cannot be used to read other files on the server", async () => {
    const ctx = build();
    const saved = await seed(ctx, isabel, { files: [pdf] });
    await writeFile(path.join(base, "secret.txt"), "the secret");
    const token = await businessToken(isabel);

    for (const name of ["..%2Fsecret.txt", "%2e%2e%2fsecret.txt", "..%5Csecret.txt", "..%2F..%2F..%2Fetc%2Fpasswd", "%2Fetc%2Fpasswd", "secret.txt"]) {
      const res = await download(ctx.app, `/api/b2b/requests/${saved.id}/assets/${name}`, token);

      expect(res.status, name).toBe(404);
      expect(JSON.stringify(res.body)).not.toContain("the secret");
      expect(res.headers["content-disposition"]).toBeUndefined();
    }
  });

  it("answers 404, not a file, when the request lists a file that is no longer in the storage", async () => {
    const ctx = build();
    const saved = await seed(ctx, isabel, { files: [pdf] });
    await rm(path.join(base, "store", saved.brandAssets[0].storedName));

    const res = await download(ctx.app, assetUrl(saved.id, saved.brandAssets[0].storedName), await businessToken(isabel));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("FILE_NOT_FOUND");
    // the answer is an error, it must not look like a download
    expect(res.headers["content-disposition"]).toBeUndefined();
    expect(res.headers["content-type"]).toMatch(/json/);
  });

  it("answers 400 for a request id that cannot be one", async () => {
    const { app } = build();

    const res = await download(app, "/api/b2b/requests/abc/assets/whatever.pdf", await businessToken(isabel));

    expect(res.status).toBe(400);
  });

  it("does not change or remove the stored file", async () => {
    const ctx = build();
    const saved = await seed(ctx, isabel, { files: [pdf] });
    const token = await businessToken(isabel);

    await download(ctx.app, assetUrl(saved.id, saved.brandAssets[0].storedName), token);
    await download(ctx.app, assetUrl(saved.id, saved.brandAssets[0].storedName), token);

    expect(await readdir(path.join(base, "store"))).toEqual([saved.brandAssets[0].storedName]);
  });
});

describe("PATCH /api/b2b/requests/:id: who may change the status", () => {
  it("answers 401 to a guest", async () => {
    const ctx = build();
    const saved = await seed(ctx, isabel);

    const res = await patch(ctx.app, saved.id, { status: "rejected" });

    expect(res.status).toBe(401);
    expect(res.body.error).toEqual(unauthenticated);
  });

  it("answers 403 to the owner, and to other business and retail accounts, and changes nothing", async () => {
    const ctx = build();
    const saved = await seed(ctx, isabel);

    for (const token of [await businessToken(isabel), await businessToken(marco), await retailToken(marco)]) {
      const res = await patch(ctx.app, saved.id, { status: "quoted", quoteAmount: 1 }, token);

      expect(res.status).toBe(403);
      expect(res.body.error).toEqual(forbidden);
    }
    expect(ctx.store.all()).toEqual([saved]);
  });

  it("lets an admin change any request, also when the admin has a business account", async () => {
    const ctx = build();
    const saved = await seed(ctx, isabel);
    const businessAdmin = await signToken({ id: objectId(), role: "admin", accountType: "b2b" });

    const res = await patch(ctx.app, saved.id, { status: "rejected" }, businessAdmin);

    expect(res.status).toBe(200);
    expect(res.body.request).toMatchObject({ id: saved.id, status: "rejected" });
  });
});

describe("PATCH /api/b2b/requests/:id: the status", () => {
  const valid: [RequestStatus, RequestStatus][] = [
    ["submitted", "quoted"],
    ["quoted", "approved"],
    ["quoted", "rejected"],
    ["submitted", "rejected"],
  ];
  const invalid = requestStatuses
    .flatMap((from) => requestStatuses.map((to) => [from, to] as const))
    .filter(([from, to]) => !valid.some(([a, b]) => a === from && b === to));

  // a quote needs an amount (in cents), the other statuses cannot have one
  const body = (status: RequestStatus) => (status === "quoted" ? { status, quoteAmount: 125000 } : { status });

  it.each(valid)("changes %s to %s and answers 200 with the request", async (from, to) => {
    const ctx = build();
    const saved = await seed(ctx, isabel, { status: from });

    const res = await patch(ctx.app, saved.id, body(to), await adminToken());

    expect(res.status).toBe(200);
    expect(res.body.request).toMatchObject({ id: saved.id, userId: isabel, status: to });
    expect(ctx.store.all()).toEqual([res.body.request]);
  });

  it.each(invalid)("refuses to change %s to %s with 400 INVALID_TRANSITION, and leaves the request as it was", async (from, to) => {
    const ctx = build();
    const saved = await seed(ctx, isabel, { status: from });

    const res = await patch(ctx.app, saved.id, body(to), await adminToken());

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: "INVALID_TRANSITION", details: [{ field: "status", message: res.body.error.message }] });
    expect(res.body.error.message).toContain(from);
    expect(ctx.store.all()).toEqual([saved]);
  });

  it("explains where a request can go from its status", async () => {
    const ctx = build();
    const submitted = await seed(ctx, isabel);
    const approved = await seed(ctx, isabel, { status: "approved" });
    const token = await adminToken();

    expect((await patch(ctx.app, submitted.id, { status: "approved" }, token)).body.error.message).toBe(
      "A submitted request can't be changed to approved. It can only move to quoted or rejected.",
    );
    expect((await patch(ctx.app, approved.id, { status: "rejected" }, token)).body.error.message).toBe("A request that is approved is final and can't be changed.");
  });

  it("saves the amount in cents and the note when it quotes", async () => {
    const ctx = build();
    const saved = await seed(ctx, isabel);

    const res = await patch(ctx.app, saved.id, { status: "quoted", quoteAmount: 125000, quoteNote: "Includes shipping to Dallas." }, await adminToken());

    expect(res.body.request).toMatchObject({ status: "quoted", quoteAmount: 125000, quoteNote: "Includes shipping to Dallas." });
    expect(Date.parse(res.body.request.updatedAt)).toBeGreaterThan(Date.parse(saved.updatedAt));
    expect(res.body.request.createdAt).toBe(saved.createdAt);
  });

  it("keeps the quote when the request is approved or rejected afterwards", async () => {
    const ctx = build();
    const toApprove = await seed(ctx, isabel, { status: "quoted" });
    const toReject = await seed(ctx, isabel, { status: "quoted" });
    const token = await adminToken();

    const approved = await patch(ctx.app, toApprove.id, { status: "approved" }, token);
    const rejected = await patch(ctx.app, toReject.id, { status: "rejected", quoteNote: "They went with another supplier." }, token);

    expect(approved.body.request).toMatchObject({ status: "approved", quoteAmount: 5000, quoteNote: "Valid for 30 days." });
    expect(rejected.body.request).toMatchObject({ status: "rejected", quoteAmount: 5000, quoteNote: "They went with another supplier." });
  });

  it("lets the owner see the quote after it was made", async () => {
    const ctx = build();
    const saved = await seed(ctx, isabel);
    await patch(ctx.app, saved.id, { status: "quoted", quoteAmount: 99900 }, await adminToken());

    const res = await get(ctx.app, `/api/b2b/requests/${saved.id}`, await businessToken(isabel));

    expect(res.body.request).toMatchObject({ status: "quoted", quoteAmount: 99900 });
  });

  it("goes through the whole way: submitted, quoted, approved, and then nothing more", async () => {
    const ctx = build();
    const saved = await seed(ctx, isabel);
    const token = await adminToken();

    expect((await patch(ctx.app, saved.id, { status: "quoted", quoteAmount: 5000 }, token)).status).toBe(200);
    expect((await patch(ctx.app, saved.id, { status: "approved" }, token)).status).toBe(200);
    for (const status of requestStatuses) {
      const res = await patch(ctx.app, saved.id, body(status), token);
      expect(res.status, status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_TRANSITION");
    }
  });
});

describe("PATCH /api/b2b/requests/:id: what is wrong with the change", () => {
  it("asks for an amount when it quotes", async () => {
    const ctx = build();
    const saved = await seed(ctx, isabel);

    const res = await patch(ctx.app, saved.id, { status: "quoted" }, await adminToken());

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: "VALIDATION_ERROR",
      message: "A quoted request needs a quoteAmount, in cents.",
      details: [{ field: "quoteAmount", message: "A quoted request needs a quoteAmount, in cents." }],
    });
    expect(ctx.store.all()).toEqual([saved]);
  });

  it("refuses an amount that is not a positive whole number of cents", async () => {
    const ctx = build();
    const saved = await seed(ctx, isabel);
    const token = await adminToken();

    for (const quoteAmount of [0, -100, 12.5, "5000", null, true, 1e30]) {
      const res = await patch(ctx.app, saved.id, { status: "quoted", quoteAmount }, token);

      expect(res.status, String(quoteAmount)).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.details[0].field).toBe("quoteAmount");
    }
    expect(ctx.store.all()).toEqual([saved]);
  });

  it("does not take an amount with any other status, because the price is set once", async () => {
    const ctx = build();
    const quoted = await seed(ctx, isabel, { status: "quoted" });

    for (const status of ["approved", "rejected"]) {
      const res = await patch(ctx.app, quoted.id, { status, quoteAmount: 1 }, await adminToken());

      expect(res.status, status).toBe(400);
      expect(res.body.error.details).toEqual([{ field: "quoteAmount", message: "The quoteAmount can only be set when the status is quoted." }]);
    }
    expect(ctx.store.all()).toEqual([quoted]);
  });

  it("refuses a status that does not exist, or none at all", async () => {
    const ctx = build();
    const saved = await seed(ctx, isabel);
    const token = await adminToken();
    const message = `status must be one of: ${requestStatuses.join(", ")}.`;

    for (const data of [{ status: "done" }, { status: "QUOTED", quoteAmount: 5000 }, { status: 1 }, { status: null }, { quoteAmount: 5000 }, {}]) {
      const res = await patch(ctx.app, saved.id, data, token);

      expect(res.status, JSON.stringify(data)).toBe(400);
      expect(res.body.error).toMatchObject({ code: "VALIDATION_ERROR", message });
    }
    expect(ctx.store.all()).toEqual([saved]);
  });

  it("answers 400 when there is no body at all, and when the body is not JSON", async () => {
    const ctx = build();
    const saved = await seed(ctx, isabel);
    const token = await adminToken();

    const empty = await request(ctx.app).patch(`/api/b2b/requests/${saved.id}`).set(bearer(token));
    const broken = await request(ctx.app).patch(`/api/b2b/requests/${saved.id}`).set(bearer(token)).set("Content-Type", "application/json").send("{ not json");

    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe("VALIDATION_ERROR");
    expect(broken.status).toBe(400);
    expect(broken.body.error.code).toBe("INVALID_JSON");
  });

  it("names every field that is wrong", async () => {
    const ctx = build();
    const saved = await seed(ctx, isabel);

    const res = await patch(ctx.app, saved.id, { status: "nope", quoteAmount: "lots", quoteNote: 7 }, await adminToken());

    expect(res.body.error.details.map((detail: { field: string }) => detail.field)).toEqual(["status", "quoteAmount", "quoteNote"]);
  });

  it("strips HTML from the note, and ignores an empty one", async () => {
    const ctx = build();
    const saved = await seed(ctx, isabel);
    const other = await seed(ctx, isabel);
    const token = await adminToken();

    const dirty = await patch(ctx.app, saved.id, { status: "quoted", quoteAmount: 5000, quoteNote: "<b>Ready</b> <script>alert(1)</script>soon" }, token);
    const blank = await patch(ctx.app, other.id, { status: "quoted", quoteAmount: 5000, quoteNote: "   " }, token);

    expect(dirty.body.request.quoteNote).toBe("Ready soon");
    expect(blank.body.request.quoteNote).toBeUndefined();
  });

  it("changes only the status and the quote, whatever else is sent", async () => {
    const ctx = build();
    const saved = await seed(ctx, isabel, { files: [pdf] });

    const res = await patch(
      ctx.app,
      saved.id,
      { status: "quoted", quoteAmount: 5000, userId: marco, companyName: "Other Company", quantityEstimate: 1, brandAssets: [], id: objectId(), createdAt: "2000-01-01T00:00:00.000Z" },
      await adminToken(),
    );

    expect(res.status).toBe(200);
    expect(res.body.request).toEqual({ ...saved, status: "quoted", quoteAmount: 5000, updatedAt: expect.any(String) });
  });

  it("answers 404 for a request that is not there, and 400 for an id that cannot be one", async () => {
    const { app } = build();
    const token = await adminToken();

    const missing = await patch(app, objectId(), { status: "rejected" }, token);
    const malformed = await patch(app, "abc", { status: "rejected" }, token);

    expect(missing.status).toBe(404);
    expect(missing.body.error).toEqual(notFound);
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.message).toBe("That isn't a valid request id.");
  });

  it("answers 409 when somebody else changed the request while this change was being made", async () => {
    const memory = createMemoryB2BStore();
    const racing: B2BRequestStore = { ...memory, transition: async () => null };
    const ctx = build({ store: racing });
    const saved = await memory.create(await newRequest(ctx.storage, isabel));

    const res = await patch(ctx.app, saved.id, { status: "rejected" }, await adminToken());

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({ code: "REQUEST_CHANGED", message: "Someone just changed this request. Please reload it and try again.", details: [] });
    expect(await memory.findById(saved.id)).toEqual(saved);
  });
});
