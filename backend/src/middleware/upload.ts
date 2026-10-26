// Upload middleware for brand assets (PDF, AI, EPS and PNG, see services/fileCheck.ts).
//
// Why multer writes to disk and not to memory: the limits allow 5 files of 50 MB in one request.
// Held in memory that is 250 MB for a single upload, and a few uploads at once could take the server down.
// So multer streams each file into a private temp folder under a random name. Only after every file has
// been checked (extension, type and first bytes) are they handed to the storage service. The storage service
// is the only part that knows where files finally live, so an S3 version can replace the disk one later.
//
// The name the person gave a file is only used to read its extension and to show messages.
// It is never used in a path.
import { randomUUID } from "node:crypto";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import type { RequestHandler, Response } from "express";
import multer, { MulterError } from "multer";
import { env } from "../config/env.ts";
import { AppError } from "../errors/AppError.ts";
import { checkFile, type FileProblem } from "../services/fileCheck.ts";
import { storage as defaultStorage, type StorageService } from "../services/storage.service.ts";

// what the routes get: the same fields a brand asset is saved with
export interface StoredUpload {
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface UploadOptions {
  storage: StorageService;
  // private folder where files wait while they are checked
  tempDir: string;
  maxFileBytes: number;
  maxFiles: number;
  // the form field the files must be sent in
  fieldName: string;
}

const problemCodes: Record<FileProblem, string> = {
  "unsupported-type": "UNSUPPORTED_FILE_TYPE",
  "content-mismatch": "FILE_CONTENT_MISMATCH",
  empty: "EMPTY_FILE",
};

// the file name as text we can work with: no folders and no control characters
function cleanName(rawName: string): string {
  // browsers send UTF-8 names and multer reads them as latin1, so convert them back
  const name = Buffer.from(rawName, "latin1").toString("utf8");
  const lastPart = name.split(/[\\/]/).pop() ?? "";
  const clean = lastPart.replace(/\p{Cc}/gu, "").trim();
  return clean === "" ? "file" : clean;
}

// a name that is short enough to show and to save, it keeps its extension
function shortName(name: string): string {
  if (name.length <= 100) return name;
  const extension = path.extname(name);
  return `${name.slice(0, 97 - extension.length)}...${extension}`;
}

function describeSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function problemMessage(problem: FileProblem, name: string, extension: string): string {
  if (problem === "empty") return `"${name}" is empty.`;
  if (problem === "content-mismatch") return `"${name}" doesn't look like a real ${extension.slice(1).toUpperCase()} file.`;
  return `"${name}" isn't a supported file. Use PDF, AI, EPS or PNG.`;
}

// turns what multer throws into our standard errors, anything we don't know stays as it is
function toUploadError(error: unknown, options: UploadOptions): unknown {
  if (error instanceof MulterError) {
    switch (error.code) {
      case "LIMIT_FILE_SIZE":
        return new AppError("FILE_TOO_LARGE", 413, `That file is too big. Each file can be up to ${describeSize(options.maxFileBytes)}.`);
      case "LIMIT_FILE_COUNT":
        return new AppError("TOO_MANY_FILES", 400, `Too many files. You can upload up to ${options.maxFiles} at a time.`);
      case "LIMIT_UNEXPECTED_FILE":
        return new AppError("UNEXPECTED_FILE_FIELD", 400, `Send the files in the "${options.fieldName}" field.`);
      default:
        return new AppError("INVALID_UPLOAD", 400, "The upload request isn't valid.");
    }
  }
  // a cut off or broken multipart body, from the parser underneath multer
  if (error instanceof Error && /^(Unexpected end of form|Malformed|Multipart)/.test(error.message)) {
    return new AppError("INVALID_UPLOAD", 400, "The upload request isn't valid.");
  }
  return error;
}

async function removeQuietly(paths: string[]) {
  await Promise.allSettled(paths.map((file) => unlink(file)));
}

export function createUpload(options: UploadOptions): RequestHandler {
  const { storage, tempDir, maxFileBytes, maxFiles, fieldName } = options;

  const parse = multer({
    storage: multer.diskStorage({
      destination(_req, _file, done) {
        mkdir(tempDir, { recursive: true }).then(
          () => done(null, tempDir),
          (error: Error) => done(error, tempDir),
        );
      },
      // a random name, the original one is not used here either
      filename(_req, _file, done) {
        done(null, randomUUID());
      },
    }),
    limits: { fileSize: maxFileBytes, files: maxFiles, fields: 20 },
  }).array(fieldName);

  // checks every file first, then stores them all, so a bad file means nothing is stored
  async function checkAndStore(files: Express.Multer.File[], res: Response) {
    const extensions: string[] = [];
    const problems: { file: string; code: string; message: string }[] = [];

    for (const file of files) {
      const fullName = cleanName(file.originalname);
      const result = await checkFile({ originalName: fullName, mimeType: file.mimetype, size: file.size, path: file.path });
      if (result.ok) {
        extensions.push(result.extension);
      } else {
        const name = shortName(fullName);
        const extension = path.extname(fullName).toLowerCase();
        problems.push({ file: name, code: problemCodes[result.problem], message: problemMessage(result.problem, name, extension) });
      }
    }

    if (problems.length > 0) {
      const message = problems.length === 1 ? problems[0].message : "Some of the files can't be used.";
      throw new AppError(problems[0].code, 400, message, problems);
    }

    const stored: StoredUpload[] = [];
    try {
      for (const [index, file] of files.entries()) {
        const { storedName } = await storage.save({ tempPath: file.path, extension: extensions[index], mimeType: file.mimetype });
        stored.push({ originalName: shortName(cleanName(file.originalname)), storedName, mimeType: file.mimetype, sizeBytes: file.size });
      }
    } catch (error) {
      await Promise.allSettled(stored.map((upload) => storage.remove(upload.storedName)));
      throw error;
    }

    res.locals.uploads = stored;

    // if the request ends badly later (the form fails its own checks, the route errors, the client leaves),
    // the files that were stored for it are deleted, so nothing is left without a request
    res.once("close", () => {
      if (res.statusCode < 400 && res.writableFinished) return;
      void Promise.allSettled(stored.map((upload) => storage.remove(upload.storedName)));
    });
  }

  return function upload(req, res, next) {
    parse(req, res, (error) => {
      if (error) {
        next(toUploadError(error, options));
        return;
      }
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      res.locals.uploads = [];
      checkAndStore(files, res)
        .then(() => next())
        .catch(next)
        // whatever happened, no temp file is kept (stored ones were moved, so those are already gone)
        .finally(() => removeQuietly(files.map((file) => file.path)));
    });
  };
}

// the files that were stored for this request (empty when none were sent)
export function uploadsFrom(res: Response): StoredUpload[] {
  return res.locals.uploads ?? [];
}

const uploadRoot = path.resolve(env.UPLOAD_DIR);

export const uploadBrandAssets = createUpload({
  storage: defaultStorage,
  tempDir: path.join(uploadRoot, "tmp"),
  maxFileBytes: Math.floor(env.MAX_UPLOAD_MB * 1024 * 1024),
  maxFiles: env.MAX_UPLOAD_FILES,
  fieldName: "brandAssets",
});
