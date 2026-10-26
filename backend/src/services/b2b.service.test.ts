import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../errors/AppError.ts";
import type { StoredUpload } from "../middleware/upload.ts";
import { createMemoryB2BStore } from "../test/memoryB2BStore.ts";
import { createB2BService, type QuoteMail } from "./b2b.service.ts";
import type { B2BRequestStore } from "./b2b.store.ts";
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
