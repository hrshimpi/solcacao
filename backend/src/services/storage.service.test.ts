import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "../errors/AppError.ts";
import { createDiskStorage, type StorageService } from "./storage.service.ts";

const storedNameShape = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/;

let base: string;
let storeDir: string;
let tempDir: string;
let storage: StorageService;

beforeEach(async () => {
  base = await mkdtemp(path.join(tmpdir(), "solcacao-storage-"));
  storeDir = path.join(base, "store");
  tempDir = path.join(base, "tmp");
  await mkdir(tempDir);
  storage = createDiskStorage(storeDir);
});

afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

async function tempFile(content: string) {
  const file = path.join(tempDir, "upload-123");
  await writeFile(file, content);
  return file;
}

async function readAll(stream: AsyncIterable<Buffer | string>) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString();
}

describe("disk storage: save", () => {
  it("stores the file under a random name that keeps the extension", async () => {
    const { storedName } = await storage.save({ tempPath: await tempFile("%PDF-1.7 hello"), extension: ".pdf", mimeType: "application/pdf" });

    expect(storedName).toMatch(storedNameShape);
    expect(await readFile(path.join(storeDir, storedName), "utf8")).toBe("%PDF-1.7 hello");
  });

  it("creates the folder when it does not exist yet", async () => {
    await expect(stat(storeDir)).rejects.toThrow();

    await storage.save({ tempPath: await tempFile("x"), extension: ".png", mimeType: "image/png" });

    expect((await stat(storeDir)).isDirectory()).toBe(true);
  });

  it("takes the temp file away, so nothing is left behind", async () => {
    await storage.save({ tempPath: await tempFile("x"), extension: ".pdf", mimeType: "application/pdf" });

    expect(await readdir(tempDir)).toEqual([]);
  });

  it("gives every file its own name, even for the same content", async () => {
    const first = await storage.save({ tempPath: await tempFile("same"), extension: ".pdf", mimeType: "application/pdf" });
    const second = await storage.save({ tempPath: await tempFile("same"), extension: ".pdf", mimeType: "application/pdf" });

    expect(first.storedName).not.toBe(second.storedName);
    expect(await readdir(storeDir)).toHaveLength(2);
  });

  it.each(["pdf", ".", "/../x", "..\\x", ".p/df", ".pdf/../../x", "", ".averyveryverylongextension"])(
    "refuses the extension %j, because it could change the path",
    async (extension) => {
      await expect(storage.save({ tempPath: await tempFile("x"), extension, mimeType: "application/pdf" })).rejects.toThrow();
      await expect(readdir(storeDir)).rejects.toThrow();
    },
  );
});

describe("disk storage: stream", () => {
  it("reads a stored file back", async () => {
    const { storedName } = await storage.save({ tempPath: await tempFile("%PDF-1.7 hello"), extension: ".pdf", mimeType: "application/pdf" });

    expect(await readAll(await storage.stream(storedName))).toBe("%PDF-1.7 hello");
  });

  it("says 404 when the file is gone", async () => {
    await expect(storage.stream("11111111-2222-3333-4444-555555555555.pdf")).rejects.toMatchObject({
      status: 404,
      code: "FILE_NOT_FOUND",
    });
  });
});

describe("disk storage: remove", () => {
  it("deletes the file", async () => {
    const { storedName } = await storage.save({ tempPath: await tempFile("x"), extension: ".pdf", mimeType: "application/pdf" });

    await storage.remove(storedName);

    expect(await readdir(storeDir)).toEqual([]);
  });

  it("does not mind when the file is already gone", async () => {
    await expect(storage.remove("11111111-2222-3333-4444-555555555555.pdf")).resolves.toBeUndefined();
  });
});

describe("disk storage: names that are not ours", () => {
  const bad = [
    "../secret.pdf",
    "..\\secret.pdf",
    "/etc/passwd",
    "C:\\Windows\\win.ini",
    "logo.png",
    "my brand logo.pdf",
    "11111111-2222-3333-4444-555555555555",
    "11111111-2222-3333-4444-555555555555.pdf/../../x",
    "../11111111-2222-3333-4444-555555555555.pdf",
    "11111111-2222-3333-4444-555555555555.pdf\0.png",
    "",
  ];

  it.each(bad)("remove and stream refuse %j", async (name) => {
    await expect(storage.remove(name)).rejects.toBeInstanceOf(AppError);
    await expect(storage.stream(name)).rejects.toMatchObject({ code: "INVALID_FILE_NAME", status: 400 });
  });

  it("never touches a file outside the storage folder", async () => {
    const outside = path.join(base, "outside.pdf");
    await writeFile(outside, "keep me");

    await expect(storage.remove("../outside.pdf")).rejects.toBeInstanceOf(AppError);

    expect(await readFile(outside, "utf8")).toBe("keep me");
  });
});
