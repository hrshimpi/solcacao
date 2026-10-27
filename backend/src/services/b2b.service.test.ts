import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { text } from "node:stream/consumers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../errors/AppError.ts";
import { requestStatuses, type RequestStatus } from "../models/b2b-request.model.ts";
import type { StoredUpload } from "../middleware/upload.ts";
import { createMemoryB2BStore, requestInStatus } from "../test/memoryB2BStore.ts";
import { createB2BService, type QuoteMail } from "./b2b.service.ts";
import type { B2BRequestStore, NewB2BRequest } from "./b2b.store.ts";
import type { UserProfile } from "./profile.service.ts";
import { createDiskStorage } from "./storage.service.ts";

const userId = "64b7f0c2a1b2c3d4e5f60718";
const input = {
  cacaoProfile: "Ecuador",
  packagingType: "foil_wrap" as const,
  quantityEstimate: 800,
  companyName: "Hacienda Brands",
  contactName: "Isabel Vasquez",
  notes: "Before the holidays, please.",
};
const profile: UserProfile = { email: "isabel@example.com", name: "Isabel Vasquez", companyName: "Hacienda Brands" };

let base: string;

beforeEach(async () => {
  base = await mkdtemp(path.join(tmpdir(), "solcacao-b2b-"));
});

afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

// real files in a real (temporary) storage folder, so we can see whether they are deleted
async function storedFiles(count: number) {
  const storage = createDiskStorage(path.join(base, "store"));
  await mkdir(path.join(base, "tmp"), { recursive: true });
  const uploads: StoredUpload[] = [];
  for (let i = 0; i < count; i++) {
    const tempPath = path.join(base, "tmp", `upload-${i}`);
    await writeFile(tempPath, "%PDF-1.7 content");
    const { storedName } = await storage.save({ tempPath, extension: ".pdf", mimeType: "application/pdf" });
    uploads.push({ originalName: `file-${i}.pdf`, storedName, mimeType: "application/pdf", sizeBytes: 16 });
  }
  return { storage, uploads };
}

async function setup(options: { store?: B2BRequestStore; mail?: Partial<QuoteMail>; profiles?: (id: string) => Promise<UserProfile>; files?: number } = {}) {
  const { storage, uploads } = await storedFiles(options.files ?? 0);
  const memory = createMemoryB2BStore();
  const mail = { sendQuoteNotification: vi.fn(async () => true), ...options.mail };
  const service = createB2BService({
    store: options.store ?? memory,
    storage,
    mail,
    profiles: options.profiles ?? (async () => profile),
  });
  return { service, store: memory, mail, uploads, storageFolder: path.join(base, "store") };
}

describe("createQuote", () => {
  it("saves the request for the user, as submitted and without a quote", async () => {
    const { service, store } = await setup();

    const saved = await service.createQuote(input, [], { id: userId, profile });

    expect(saved).toMatchObject({ ...input, userId, status: "submitted", quoteAmount: null, brandAssets: [] });
    expect(saved.id).toMatch(/^[0-9a-f]{24}$/);
    expect(store.all()).toEqual([saved]);
  });

  it("keeps the information about the stored files, and no public address", async () => {
    const { service, uploads } = await setup({ files: 2 });

    const saved = await service.createQuote(input, uploads, { id: userId, profile });

    expect(saved.brandAssets).toHaveLength(2);
    expect(saved.brandAssets[0]).toEqual({
      originalName: "file-0.pdf",
      storedName: uploads[0].storedName,
      mimeType: "application/pdf",
      sizeBytes: 16,
      uploadedAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT/),
    });
    expect(JSON.stringify(saved)).not.toContain("http");
  });

  it("tells the team after saving, with the customer's address to reply to", async () => {
    const { service, mail, uploads } = await setup({ files: 1 });

    const saved = await service.createQuote(input, uploads, { id: userId, profile });

    expect(mail.sendQuoteNotification).toHaveBeenCalledTimes(1);
    expect(mail.sendQuoteNotification).toHaveBeenCalledWith(
      expect.objectContaining({ companyName: "Hacienda Brands", packagingType: "foil_wrap", quantityEstimate: 800, brandAssets: saved.brandAssets }),
      { email: "isabel@example.com", name: "Isabel Vasquez" },
    );
  });

  it("still tells the team when the customer's email is not known", async () => {
    const { service, mail } = await setup();

    await service.createQuote(input, [], { id: userId, profile: {} });

    expect(mail.sendQuoteNotification).toHaveBeenCalledWith(expect.anything(), { email: "", name: "Isabel Vasquez" });
  });

  it("does not wait for the email", async () => {
    let finish: () => void = () => {};
    const { service } = await setup({ mail: { sendQuoteNotification: () => new Promise<boolean>((resolve) => (finish = () => resolve(true))) } });

    await expect(service.createQuote(input, [], { id: userId, profile })).resolves.toMatchObject({ companyName: "Hacienda Brands" });
    finish();
  });

  it("never fails because of the email, whichever way it breaks", async () => {
    const breakages: Partial<QuoteMail>[] = [
      { sendQuoteNotification: async () => false },
      { sendQuoteNotification: async () => Promise.reject(new Error("smtp is down")) },
      {
        sendQuoteNotification: () => {
          throw new Error("broken mock");
        },
      },
    ];

    for (const mail of breakages) {
      const { service, store, uploads } = await setup({ mail, files: 1 });

      await expect(service.createQuote(input, uploads, { id: userId, profile })).resolves.toBeDefined();
      expect(store.all()).toHaveLength(1);
      // the files of the request are still there
      expect(await readdir(path.join(base, "store"))).toEqual(expect.arrayContaining(uploads.map((upload) => upload.storedName)));
    }
  });

  it("deletes the stored files and sends no email when saving fails", async () => {
    const failing: B2BRequestStore = { ...createMemoryB2BStore(), create: async () => Promise.reject(new AppError("DATABASE_UNAVAILABLE", 503, "down")) };
    const { service, mail, uploads, storageFolder } = await setup({ store: failing, files: 3 });
    expect(await readdir(storageFolder)).toHaveLength(3);

    await expect(service.createQuote(input, uploads, { id: userId, profile })).rejects.toMatchObject({ status: 503 });

    expect(await readdir(storageFolder)).toEqual([]);
    expect(mail.sendQuoteNotification).not.toHaveBeenCalled();
  });
});

describe("discardUploads", () => {
  it("deletes the files, and does not mind files that are already gone", async () => {
    const { service, uploads, storageFolder } = await setup({ files: 2 });

    await service.discardUploads(uploads);
    await expect(service.discardUploads(uploads)).resolves.toBeUndefined();

    expect(await readdir(storageFolder)).toEqual([]);
  });

  it("does nothing for no files", async () => {
    const { service } = await setup();

    await expect(service.discardUploads([])).resolves.toBeUndefined();
  });
});

describe("profileOf", () => {
  it("returns what the lookup knows", async () => {
    const { service } = await setup();

    expect(await service.profileOf(userId)).toEqual(profile);
  });

  it("knows nothing instead of failing when the lookup breaks", async () => {
    const { service } = await setup({ profiles: async () => Promise.reject(new Error("database is down")) });

    expect(await service.profileOf(userId)).toEqual({});
  });
});

// reading the requests afterwards: who may see them, their files, and the status
const ownerId = userId;
const otherId = "64b7f0c2a1b2c3d4e5f60719";
const adminId = "64b7f0c2a1b2c3d4e5f607aa";
const missingId = "64b7f0c2a1b2c3d4e5f607ff";
const owner = { id: ownerId, role: "user" as const };
const stranger = { id: otherId, role: "user" as const };
const admin = { id: adminId, role: "admin" as const };
const newRequest = (overrides: Partial<NewB2BRequest> = {}): NewB2BRequest => ({ ...input, userId: ownerId, brandAssets: [], ...overrides });

describe("listFor", () => {
  it("gives a page of the user's own requests, newest first, with the number of pages", async () => {
    const { service, store } = await setup();
    const saved = [];
    for (let i = 0; i < 5; i++) saved.push(await store.create(newRequest({ companyName: `Company ${i}` })));
    await store.create(newRequest({ userId: otherId }));

    const page = await service.listFor(ownerId, { page: 2, limit: 2 });

    expect(page).toMatchObject({ page: 2, limit: 2, total: 5, totalPages: 3 });
    expect(page.items.map((item) => item.id)).toEqual([saved[2].id, saved[1].id]);
  });

  it("has no pages when the user has no requests", async () => {
    const { service } = await setup();

    expect(await service.listFor(ownerId, { page: 1, limit: 20 })).toEqual({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 });
  });

  it("counts a last page that is not full", async () => {
    const { service, store } = await setup();
    for (let i = 0; i < 21; i++) await store.create(newRequest());

    expect((await service.listFor(ownerId, { page: 1, limit: 20 })).totalPages).toBe(2);
    expect((await service.listFor(ownerId, { page: 2, limit: 20 })).items).toHaveLength(1);
  });
});

describe("get", () => {
  it("gives a request to its owner, and to an admin", async () => {
    const { service, store } = await setup();
    const saved = await store.create(newRequest());

    expect(await service.get(saved.id, owner)).toEqual(saved);
    expect(await service.get(saved.id, admin)).toEqual(saved);
  });

  it("knows the owner when the id in the token is written in capital letters", async () => {
    const { service, store } = await setup();
    const saved = await store.create(newRequest());

    expect(await service.get(saved.id, { id: ownerId.toUpperCase(), role: "user" })).toEqual(saved);
  });

  it("answers 404 for somebody else's request, the same as for a request that is not there", async () => {
    const { service, store } = await setup();
    const saved = await store.create(newRequest());

    const someoneElses = await service.get(saved.id, stranger).catch((error) => error);
    const missing = await service.get(missingId, stranger).catch((error) => error);

    expect(someoneElses).toBeInstanceOf(AppError);
    expect(someoneElses).toMatchObject({ status: 404, code: "NOT_FOUND" });
    expect({ ...someoneElses, message: someoneElses.message }).toEqual({ ...missing, message: missing.message });
  });

  it("answers 404 for an admin who asks for a request that is not there", async () => {
    const { service } = await setup();

    await expect(service.get(missingId, admin)).rejects.toMatchObject({ status: 404 });
  });
});

describe("openAsset", () => {
  it("opens a file of the request for its owner and for an admin, with what the request knows about it", async () => {
    const { service, store, uploads } = await setup({ files: 2 });
    const saved = await store.create(newRequest({ brandAssets: uploads }));

    for (const viewer of [owner, admin]) {
      const { asset, content } = await service.openAsset(saved.id, uploads[1].storedName, viewer);

      expect(asset).toMatchObject({ originalName: "file-1.pdf", storedName: uploads[1].storedName, mimeType: "application/pdf" });
      expect(await text(content)).toBe("%PDF-1.7 content");
    }
  });

  it("answers 404 for somebody else's request", async () => {
    const { service, store, uploads } = await setup({ files: 1 });
    const saved = await store.create(newRequest({ brandAssets: uploads }));

    await expect(service.openAsset(saved.id, uploads[0].storedName, stranger)).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });

  it("answers 404 for a file that is not one of the request's own, even when it exists in the storage", async () => {
    const { service, store, uploads } = await setup({ files: 2 });
    const mine = await store.create(newRequest({ brandAssets: [uploads[0]] }));
    await store.create(newRequest({ userId: otherId, brandAssets: [uploads[1]] }));

    await expect(service.openAsset(mine.id, uploads[1].storedName, owner)).rejects.toMatchObject({ status: 404, code: "FILE_NOT_FOUND" });
    // an admin sees every request, but a file is still only reached through the request it belongs to
    await expect(service.openAsset(mine.id, uploads[1].storedName, admin)).rejects.toMatchObject({ status: 404, code: "FILE_NOT_FOUND" });
  });

  it.each(["", "nothing.pdf", "../store/secret", "..\\store\\secret", "/etc/passwd", "11111111-2222-3333-4444-555555555555.pdf"])("answers 404 for the name %j", async (name) => {
    const { service, store, uploads } = await setup({ files: 1 });
    const saved = await store.create(newRequest({ brandAssets: uploads }));

    await expect(service.openAsset(saved.id, name, owner)).rejects.toMatchObject({ status: 404, code: "FILE_NOT_FOUND" });
  });

  it("answers 404 when the file is in the request but no longer in the storage", async () => {
    const { service, store, uploads, storageFolder } = await setup({ files: 1 });
    const saved = await store.create(newRequest({ brandAssets: uploads }));
    await rm(path.join(storageFolder, uploads[0].storedName));

    await expect(service.openAsset(saved.id, uploads[0].storedName, owner)).rejects.toMatchObject({ status: 404, code: "FILE_NOT_FOUND" });
  });
});

describe("changeStatus", () => {
  const valid: [RequestStatus, RequestStatus][] = [
    ["submitted", "quoted"],
    ["quoted", "approved"],
    ["quoted", "rejected"],
    ["submitted", "rejected"],
  ];
  const invalid = requestStatuses
    .flatMap((from) => requestStatuses.map((to) => [from, to] as const))
    .filter(([from, to]) => !valid.some(([a, b]) => a === from && b === to));

  // a quote needs an amount, the other changes cannot have one
  const changeTo = (status: RequestStatus) => (status === "quoted" ? { status, quoteAmount: 125000, quoteNote: "Includes shipping." } : { status });

  it.each(valid)("changes %s to %s", async (from, to) => {
    const { service, store } = await setup();
    const saved = await requestInStatus(store, from, newRequest());

    const updated = await service.changeStatus(saved.id, changeTo(to));

    expect(updated).toMatchObject({ id: saved.id, status: to });
    expect(await store.findById(saved.id)).toEqual(updated);
  });

  it.each(invalid)("refuses to change %s to %s, and leaves the request as it was", async (from, to) => {
    const { service, store } = await setup();
    const saved = await requestInStatus(store, from, newRequest());

    await expect(service.changeStatus(saved.id, changeTo(to))).rejects.toMatchObject({ status: 400, code: "INVALID_TRANSITION" });

    expect(await store.findById(saved.id)).toEqual(saved);
  });

  it("saves the quote when it quotes", async () => {
    const { service, store } = await setup();
    const saved = await store.create(newRequest());

    const quoted = await service.changeStatus(saved.id, { status: "quoted", quoteAmount: 125000, quoteNote: "Includes shipping." });

    expect(quoted).toMatchObject({ status: "quoted", quoteAmount: 125000, quoteNote: "Includes shipping." });
  });

  it("keeps the quote when the request is approved", async () => {
    const { service, store } = await setup();
    const quoted = await requestInStatus(store, "quoted", newRequest());

    const approved = await service.changeStatus(quoted.id, { status: "approved" });

    expect(approved).toMatchObject({ status: "approved", quoteAmount: 5000, quoteNote: "Valid for 30 days." });
  });

  it("answers 404 for a request that is not there", async () => {
    const { service } = await setup();

    await expect(service.changeStatus(missingId, { status: "rejected" })).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });

  it("checks the change against the status the store has, and tells the store which one that was", async () => {
    const memory = createMemoryB2BStore();
    const transition = vi.fn(memory.transition);
    const { service } = await setup({ store: { ...memory, transition } });
    const quoted = await requestInStatus(memory, "quoted", newRequest());

    await service.changeStatus(quoted.id, { status: "approved" });

    expect(transition).toHaveBeenCalledWith(quoted.id, "quoted", { status: "approved" });
  });

  it("answers 409 when somebody else changed the request in between, and changes nothing", async () => {
    const memory = createMemoryB2BStore();
    const { service } = await setup({ store: { ...memory, transition: async () => null } });
    const saved = await memory.create(newRequest());

    const error = await service.changeStatus(saved.id, { status: "rejected" }).catch((caught) => caught);

    expect(error).toMatchObject({ status: 409, code: "REQUEST_CHANGED", message: "Someone just changed this request. Please reload it and try again." });
    expect(await memory.findById(saved.id)).toEqual(saved);
  });

  it("lets only one of two admins win when they both change the request at the same moment", async () => {
    const { service, store } = await setup();
    const saved = await store.create(newRequest());

    const results = await Promise.allSettled([
      service.changeStatus(saved.id, { status: "quoted", quoteAmount: 1000 }),
      service.changeStatus(saved.id, { status: "rejected" }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  });
});
