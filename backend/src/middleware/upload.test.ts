import { mkdir, mkdtemp, readdir, readFile, rm, rmdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import { pino } from "pino";
import { pinoHttp } from "pino-http";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.ts";
import { env } from "../config/env.ts";
import { AppError } from "../errors/AppError.ts";
import { createDiskStorage, type StorageService } from "../services/storage.service.ts";
import { errorHandler } from "./errorHandler.ts";
import { createUpload, uploadsFrom } from "./upload.ts";

const uuidName = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|ai|eps|png)$/;

const pdf = Buffer.from("%PDF-1.7\nsome pdf content");
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("png content")]);
const postscript = Buffer.from("%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 10 10\n");

let base: string;
let storeDir: string;
let tempDir: string;
let storage: StorageService;

beforeEach(async () => {
  base = await mkdtemp(path.join(tmpdir(), "solcacao-upload-"));
  storeDir = path.join(base, "store");
  tempDir = path.join(base, "tmp");
  storage = createDiskStorage(storeDir);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.doUnmock("dotenv/config");
  vi.resetModules();
  await rm(base, { recursive: true, force: true });
});

function upload(overrides: { maxFileBytes?: number; maxFiles?: number; storage?: StorageService } = {}) {
  return createUpload({
    storage: overrides.storage ?? storage,
    tempDir,
    maxFileBytes: overrides.maxFileBytes ?? 1024 * 1024,
    maxFiles: overrides.maxFiles ?? 5,
    fieldName: "brandAssets",
  });
}

// a small app with one route behind the upload middleware, in front of our normal error handler
function appWith(middleware: RequestHandler, route?: RequestHandler, onError: ErrorRequestHandler = errorHandler) {
  const app = express();
  app.use(pinoHttp({ logger: pino({ level: "silent" }) }));
  app.post("/upload", middleware, route ?? ((_req, res) => void res.json({ uploads: uploadsFrom(res) })));
  app.use(onError);
  return app;
}

// every file anywhere under the test folder, as paths like "store/abc.png"
async function filesLeft() {
  const entries = await readdir(base, { recursive: true, withFileTypes: true }).catch(() => []);
  return entries.filter((entry) => entry.isFile()).map((entry) => path.relative(base, path.join(entry.parentPath, entry.name)).replaceAll("\\", "/"));
}

describe("upload: files that are accepted", () => {
  const cases: [string, string, Buffer][] = [
    ["brand-guide.pdf", "application/pdf", pdf],
    ["logo.png", "image/png", png],
    ["label.ai", "application/pdf", pdf],
    ["label.ai", "application/postscript", postscript],
    ["label.ai", "application/illustrator", pdf],
    ["label.eps", "application/postscript", postscript],
    ["label.eps", "application/octet-stream", postscript],
    ["LOGO.PNG", "image/png", png],
  ];

  it.each(cases)("stores %s sent as %s", async (filename, contentType, content) => {
    const res = await request(appWith(upload())).post("/upload").attach("brandAssets", content, { filename, contentType });

    expect(res.status).toBe(200);
    expect(res.body.uploads).toHaveLength(1);
    const [stored] = res.body.uploads;
    expect(stored.storedName).toMatch(uuidName);
    expect(stored.storedName.endsWith(path.extname(filename).toLowerCase())).toBe(true);
    expect(stored).toMatchObject({ originalName: filename, mimeType: contentType, sizeBytes: content.length });
    expect(await readFile(path.join(storeDir, stored.storedName))).toEqual(content);
    expect(await filesLeft()).toEqual([`store/${stored.storedName}`]);
  });

  it("stores several files and keeps their order", async () => {
    const res = await request(appWith(upload()))
      .post("/upload")
      .attach("brandAssets", pdf, { filename: "one.pdf", contentType: "application/pdf" })
      .attach("brandAssets", png, { filename: "two.png", contentType: "image/png" })
      .attach("brandAssets", postscript, { filename: "three.eps", contentType: "application/postscript" });

    expect(res.status).toBe(200);
    expect(res.body.uploads.map((u: { originalName: string }) => u.originalName)).toEqual(["one.pdf", "two.png", "three.eps"]);
    expect(await readdir(storeDir)).toHaveLength(3);
    expect(await readdir(tempDir)).toEqual([]);
  });

  it("is fine with a request that has no files", async () => {
    const res = await request(appWith(upload())).post("/upload").field("companyName", "Hacienda Brands");

    expect(res.status).toBe(200);
    expect(res.body.uploads).toEqual([]);
    expect(await filesLeft()).toEqual([]);
  });

  it("accepts a file that is exactly as big as the limit", async () => {
    const exact = Buffer.concat([png, Buffer.alloc(1024 - png.length)]);

    const res = await request(appWith(upload({ maxFileBytes: 1024 }))).post("/upload").attach("brandAssets", exact, { filename: "a.png", contentType: "image/png" });

    expect(res.status).toBe(200);
  });
});

describe("upload: wrong extension", () => {
  it.each(["notes.txt", "photo.jpg", "doc.docx", "run.exe", "page.html", "logo", "logo.png.exe", "logo.png."])(
    "refuses %s and leaves nothing behind",
    async (filename) => {
      const res = await request(appWith(upload())).post("/upload").attach("brandAssets", png, { filename, contentType: "image/png" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("UNSUPPORTED_FILE_TYPE");
      expect(res.body.error.message).toContain("Use PDF, AI, EPS or PNG");
      expect(await filesLeft()).toEqual([]);
    },
  );

  it("refuses a good extension sent with the wrong type", async () => {
    const res = await request(appWith(upload())).post("/upload").attach("brandAssets", png, { filename: "logo.png", contentType: "text/html" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("UNSUPPORTED_FILE_TYPE");
    expect(await filesLeft()).toEqual([]);
  });
});

describe("upload: wrong content", () => {
  it.each([
    ["logo.png", "image/png", Buffer.from("<html><script>alert(1)</script></html>")],
    ["guide.pdf", "application/pdf", png],
    ["label.eps", "application/postscript", pdf],
    ["label.ai", "application/illustrator", Buffer.from("hello, not an illustrator file")],
  ])("refuses %s when the first bytes do not match", async (filename, contentType, content) => {
    const res = await request(appWith(upload())).post("/upload").attach("brandAssets", content, { filename, contentType });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("FILE_CONTENT_MISMATCH");
    expect(res.body.error.message).toBe(`"${filename}" doesn't look like a real ${path.extname(filename).slice(1).toUpperCase()} file.`);
    expect(await filesLeft()).toEqual([]);
  });

  it("refuses an empty file", async () => {
    const res = await request(appWith(upload())).post("/upload").attach("brandAssets", Buffer.alloc(0), { filename: "empty.png", contentType: "image/png" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("EMPTY_FILE");
    expect(await filesLeft()).toEqual([]);
  });

  it("stores nothing when one file out of several is bad", async () => {
    const res = await request(appWith(upload()))
      .post("/upload")
      .attach("brandAssets", pdf, { filename: "good.pdf", contentType: "application/pdf" })
      .attach("brandAssets", Buffer.from("nope"), { filename: "bad.png", contentType: "image/png" })
      .attach("brandAssets", png, { filename: "good.png", contentType: "image/png" });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe(`"bad.png" doesn't look like a real PNG file.`);
    expect(res.body.error.details).toEqual([{ file: "bad.png", code: "FILE_CONTENT_MISMATCH", message: `"bad.png" doesn't look like a real PNG file.` }]);
    expect(await filesLeft()).toEqual([]);
  });

  it("lists every bad file when there are several", async () => {
    const res = await request(appWith(upload()))
      .post("/upload")
      .attach("brandAssets", Buffer.from("x"), { filename: "bad.png", contentType: "image/png" })
      .attach("brandAssets", png, { filename: "notes.txt", contentType: "text/plain" });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe("Some of the files can't be used.");
    expect(res.body.error.details.map((d: { file: string; code: string }) => [d.file, d.code])).toEqual([
      ["bad.png", "FILE_CONTENT_MISMATCH"],
      ["notes.txt", "UNSUPPORTED_FILE_TYPE"],
    ]);
    expect(await filesLeft()).toEqual([]);
  });
});

describe("upload: limits", () => {
  it("answers 413 when a file is too big", async () => {
    const tooBig = Buffer.concat([png, Buffer.alloc(3000)]);

    const res = await request(appWith(upload({ maxFileBytes: 1024 }))).post("/upload").attach("brandAssets", tooBig, { filename: "big.png", contentType: "image/png" });

    expect(res.status).toBe(413);
    expect(res.body.error).toEqual({ code: "FILE_TOO_LARGE", message: "That file is too big. Each file can be up to 1 KB.", details: [] });
    expect(await filesLeft()).toEqual([]);
  });

  it("says the limit in MB for bigger limits", async () => {
    const tooBig = Buffer.concat([png, Buffer.alloc(3 * 1024 * 1024)]);

    const res = await request(appWith(upload({ maxFileBytes: 2 * 1024 * 1024 }))).post("/upload").attach("brandAssets", tooBig, { filename: "big.png", contentType: "image/png" });

    expect(res.status).toBe(413);
    expect(res.body.error.message).toBe("That file is too big. Each file can be up to 2 MB.");
    expect(await filesLeft()).toEqual([]);
  });

  it("leaves nothing behind when the big file comes after good ones", async () => {
    const tooBig = Buffer.concat([png, Buffer.alloc(3000)]);

    const res = await request(appWith(upload({ maxFileBytes: 1024 })))
      .post("/upload")
      .attach("brandAssets", pdf, { filename: "good.pdf", contentType: "application/pdf" })
      .attach("brandAssets", tooBig, { filename: "big.png", contentType: "image/png" });

    expect(res.status).toBe(413);
    expect(await filesLeft()).toEqual([]);
  });

  it("answers 400 when there are too many files", async () => {
    const res = await request(appWith(upload({ maxFiles: 2 })))
      .post("/upload")
      .attach("brandAssets", pdf, { filename: "1.pdf", contentType: "application/pdf" })
      .attach("brandAssets", pdf, { filename: "2.pdf", contentType: "application/pdf" })
      .attach("brandAssets", pdf, { filename: "3.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({ code: "TOO_MANY_FILES", message: "Too many files. You can upload up to 2 at a time.", details: [] });
    expect(await filesLeft()).toEqual([]);
  });

  it("accepts exactly as many files as the limit", async () => {
    const res = await request(appWith(upload({ maxFiles: 2 })))
      .post("/upload")
      .attach("brandAssets", pdf, { filename: "1.pdf", contentType: "application/pdf" })
      .attach("brandAssets", pdf, { filename: "2.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(200);
    expect(res.body.uploads).toHaveLength(2);
  });

  it("answers 400 when the files are sent in the wrong field", async () => {
    const res = await request(appWith(upload())).post("/upload").attach("avatar", png, { filename: "logo.png", contentType: "image/png" });

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({ code: "UNEXPECTED_FILE_FIELD", message: 'Send the files in the "brandAssets" field.', details: [] });
    expect(await filesLeft()).toEqual([]);
  });

  it("answers 400 when the body is cut off", async () => {
    const body = '--xyz\r\nContent-Disposition: form-data; name="brandAssets"; filename="a.png"\r\nContent-Type: image/png\r\n\r\npartial data with no end';

    const res = await request(appWith(upload())).post("/upload").set("Content-Type", "multipart/form-data; boundary=xyz").send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_UPLOAD");
    expect(await filesLeft()).toEqual([]);
  });
});

describe("upload: a request that is not a good form", () => {
  const standardError = (code: string) => ({ code, message: "The upload request isn't valid.", details: [] });

  it("answers 400 when there are more text fields than the 20 that are allowed, and stores nothing", async () => {
    const call = request(appWith(upload())).post("/upload");
    for (let index = 0; index < 21; index += 1) call.field(`field${index}`, "x");
    const res = await call.attach("brandAssets", png, { filename: "logo.png", contentType: "image/png" });

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(standardError("INVALID_UPLOAD"));
    expect(await filesLeft()).toEqual([]);
  });

  it("answers 400 when a text field is huge, and stores nothing", async () => {
    const res = await request(appWith(upload()))
      .post("/upload")
      .field("notes", "n".repeat(2 * 1024 * 1024))
      .attach("brandAssets", png, { filename: "logo.png", contentType: "image/png" });

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(standardError("INVALID_UPLOAD"));
    expect(await filesLeft()).toEqual([]);
  });

  it("answers 400 for a multipart request without a boundary", async () => {
    const res = await request(appWith(upload())).post("/upload").set("Content-Type", "multipart/form-data").send("this is not a form");

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(standardError("INVALID_UPLOAD"));
  });

  it("answers 400 for a form whose parts are not closed properly", async () => {
    const res = await request(appWith(upload()))
      .post("/upload")
      .set("Content-Type", "multipart/form-data; boundary=xyz")
      .send('--xyz\r\nContent-Disposition: form-data; name="brandAssets"; filename="a.png"\r\nContent-Type: image/png\r\n\r\nnot finished');

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(standardError("INVALID_UPLOAD"));
    expect(await filesLeft()).toEqual([]);
  });

  it("answers 400 when a file name has a null character in it", async () => {
    const res = await request(appWith(upload())).post("/upload").attach("brandAssets", png, { filename: "bad\u0000.png", contentType: "image/png" });

    expect(res.status).toBe(400);
    expect(await filesLeft()).toEqual([]);
  });

  it("is not tricked by a field named like a part of the object chain", async () => {
    const res = await request(appWith(upload()))
      .post("/upload")
      .field("__proto__[polluted]", "yes")
      .field("constructor[prototype][polluted]", "yes")
      .attach("brandAssets", png, { filename: "logo.png", contentType: "image/png" });

    expect(res.status).toBe(200);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("answers with the standard 500 when its own temporary folder cannot be made, and stores nothing", async () => {
    // a plain file where the folder should go
    await writeFile(path.join(base, "tmp"), "in the way");
    const res = await request(appWith(upload())).post("/upload").attach("brandAssets", png, { filename: "logo.png", contentType: "image/png" });

    expect(res.status).toBe(500);
    expect(res.body.error).toEqual({ code: "INTERNAL_ERROR", message: "Something went wrong on our side.", details: [] });
    expect(await filesLeft()).toEqual(["tmp"]);
  });
});

describe("upload: cleanup after a failure", () => {
  const files = (req: request.Test) =>
    req
      .attach("brandAssets", pdf, { filename: "one.pdf", contentType: "application/pdf" })
      .attach("brandAssets", png, { filename: "two.png", contentType: "image/png" });

  it("deletes the stored files when the form fails its own checks afterwards", async () => {
    const route: RequestHandler = () => {
      throw new AppError("VALIDATION_ERROR", 400, "Please enter your company name.");
    };

    const res = await files(request(appWith(upload(), route)).post("/upload"));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    await vi.waitFor(async () => expect(await filesLeft()).toEqual([]));
  });

  it("deletes them when the route fails with an unexpected error", async () => {
    const route: RequestHandler = () => {
      throw new Error("database is down");
    };

    const res = await files(request(appWith(upload(), route)).post("/upload"));

    expect(res.status).toBe(500);
    await vi.waitFor(async () => expect(await filesLeft()).toEqual([]));
  });

  it("deletes them when the route answers with any error status", async () => {
    const route: RequestHandler = (_req, res) => void res.status(422).json({ ok: false });

    await files(request(appWith(upload(), route)).post("/upload"));

    await vi.waitFor(async () => expect(await filesLeft()).toEqual([]));
  });

  it("keeps them when the request works", async () => {
    const route: RequestHandler = (_req, res) => void res.status(201).json({ uploads: uploadsFrom(res) });

    const res = await files(request(appWith(upload(), route)).post("/upload"));
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(res.status).toBe(201);
    expect(await readdir(storeDir)).toHaveLength(2);
    expect(await readdir(tempDir)).toEqual([]);
  });

  it("removes the files already stored when saving a later one fails", async () => {
    let calls = 0;
    const brokenStorage: StorageService = {
      ...storage,
      async save(file) {
        calls += 1;
        if (calls === 2) throw new Error("disk is full");
        return storage.save(file);
      },
    };

    const res = await files(request(appWith(upload({ storage: brokenStorage }))).post("/upload"));

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(await filesLeft()).toEqual([]);
  });
});

describe("upload: names the person gave are never used as paths", () => {
  const sneaky = ["../../evil.png", "..\\..\\evil.png", "C:\\Windows\\evil.png", "a/b/c.png", "/etc/passwd.png", "..%2F..%2Fevil.png", "con.png", `${"x".repeat(300)}.png`];

  it.each(sneaky)("stores %j in the storage folder under a random name", async (filename) => {
    const res = await request(appWith(upload())).post("/upload").attach("brandAssets", png, { filename, contentType: "image/png" });

    expect(res.status).toBe(200);
    const [stored] = res.body.uploads;
    expect(stored.storedName).toMatch(uuidName);
    // the only file anywhere is the stored one, directly inside the storage folder
    expect(await filesLeft()).toEqual([`store/${stored.storedName}`]);
    // the name we keep for display has no folders in it and is not too long
    expect(stored.originalName).not.toMatch(/[\\/]/);
    expect(stored.originalName.length).toBeLessThanOrEqual(100);
    expect(stored.storedName).not.toContain("evil");
  });

  it("keeps accents in the name we show", async () => {
    const res = await request(appWith(upload())).post("/upload").attach("brandAssets", png, { filename: "logo été.png", contentType: "image/png" });

    expect(res.body.uploads[0].originalName).toBe("logo été.png");
  });

  it("never serves or writes outside its two folders", async () => {
    await request(appWith(upload())).post("/upload").attach("brandAssets", png, { filename: "../../evil.png", contentType: "image/png" });

    expect(await readdir(base)).toEqual(expect.arrayContaining(["store"]));
    expect((await readdir(base)).filter((entry) => entry !== "store" && entry !== "tmp")).toEqual([]);
  });
});

describe("upload: settings from the environment", () => {
  // loads upload.ts fresh with the given settings and without reading a real .env file
  async function uploadWith(settings: Record<string, string>) {
    vi.resetModules();
    vi.doMock("dotenv/config", () => ({}));
    for (const [key, value] of Object.entries(settings)) vi.stubEnv(key, value);
    // the error handler has to come from the same fresh copy, or it would not recognise our AppError class
    const [uploadModule, handlerModule] = await Promise.all([import("./upload.ts"), import("./errorHandler.ts")]);
    return { uploadBrandAssets: uploadModule.uploadBrandAssets, onError: handlerModule.errorHandler };
  }

  it("uses UPLOAD_DIR, MAX_UPLOAD_MB and MAX_UPLOAD_FILES", async () => {
    const { uploadBrandAssets, onError } = await uploadWith({ UPLOAD_DIR: base, MAX_UPLOAD_MB: "0.001", MAX_UPLOAD_FILES: "1" });
    const app = appWith(uploadBrandAssets, undefined, onError);

    const tooBig = Buffer.concat([png, Buffer.alloc(3000)]);
    const big = await request(app).post("/upload").attach("brandAssets", tooBig, { filename: "big.png", contentType: "image/png" });
    expect(big.status).toBe(413);

    const many = await request(app)
      .post("/upload")
      .attach("brandAssets", png, { filename: "1.png", contentType: "image/png" })
      .attach("brandAssets", png, { filename: "2.png", contentType: "image/png" });
    expect(many.status).toBe(400);
    expect(many.body.error.code).toBe("TOO_MANY_FILES");

    const fine = await request(app).post("/upload").attach("brandAssets", png, { filename: "ok.png", contentType: "image/png" });
    expect(fine.status).toBe(200);
    // the uploads folder is the test folder here, so the one stored file sits right in it
    const left = await filesLeft();
    expect(left).toHaveLength(1);
    expect(left[0]).toMatch(uuidName);
  });

  it("has defaults of ./uploads, 50 MB and 5 files", async () => {
    vi.resetModules();
    vi.doMock("dotenv/config", () => ({}));
    for (const key of ["UPLOAD_DIR", "MAX_UPLOAD_MB", "MAX_UPLOAD_FILES"]) vi.stubEnv(key, undefined);

    const { env } = await import("../config/env.ts");

    expect(env.UPLOAD_DIR).toBe("./uploads");
    expect(env.MAX_UPLOAD_MB).toBe(50);
    expect(env.MAX_UPLOAD_FILES).toBe(5);
  });
});

describe("upload: the uploads folder is private", () => {
  it("is not served as static files, whatever the address", async () => {
    // a real file in the real uploads folder (it is ignored by git and removed again below)
    const folder = path.resolve(env.UPLOAD_DIR);
    const name = "11111111-2222-3333-4444-555555555555.png";
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, name), png);

    try {
      const app = createApp();
      for (const url of [`/uploads/${name}`, `/${name}`, `/api/uploads/${name}`, `/api/${name}`, `/static/${name}`]) {
        const res = await request(app).get(url);
        expect(res.status, url).toBe(404);
        expect(res.body).not.toEqual(png);
      }

      // not the folder, its temporary folder or a way around the address either, and not with HEAD or OPTIONS
      for (const url of ["/uploads", "/uploads/", "/uploads/tmp/", `/files/${name}`, `/public/${name}`, `/%2e%2e/uploads/${name}`, `/api/b2b/uploads/${name}`, `/api/b2b/${name}`]) {
        for (const method of ["get", "head", "options"] as const) {
          const res = await request(app)[method](url);
          expect(res.status, `${method.toUpperCase()} ${url}`).toBe(404);
          expect(Buffer.isBuffer(res.body) ? res.body.equals(png) : false).toBe(false);
        }
      }
    } finally {
      await rm(path.join(folder, name), { force: true });
      // remove the folder too if it was only made for this test (rmdir refuses when it still has files)
      await rmdir(folder).catch(() => {});
    }
  });
});
