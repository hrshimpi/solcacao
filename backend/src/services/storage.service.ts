// Where uploaded files live. The rest of the app only talks to the StorageService interface
// (save, remove, stream), so the disk version below can be replaced by an Amazon S3 one later
// without changing anything that calls it.
// A file is stored under a random name: a uuid plus the extension that was already checked.
// The name the person gave the file is never used to build a path.
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { env } from "../config/env.ts";
import { AppError } from "../errors/AppError.ts";

export interface FileToStore {
  // where the upload waits right now, in a private temp file
  tempPath: string;
  // the checked extension, in lower case with the dot, like ".pdf"
  extension: string;
  mimeType: string;
}

export interface StorageService {
  // takes over the temp file and returns the name it is stored under
  save(file: FileToStore): Promise<{ storedName: string }>;
  // deletes a stored file, it is fine if it is already gone
  remove(storedName: string): Promise<void>;
  // reads a stored file, for the routes that give it back to someone allowed to see it
  stream(storedName: string): Promise<Readable>;
}

// exactly what save() makes: a uuid and a short extension, nothing that could move a path somewhere else
const storedNamePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,8}$/;
const extensionPattern = /^\.[a-z0-9]{1,8}$/;

function errorCode(error: unknown) {
  return (error as NodeJS.ErrnoException).code;
}

export function createDiskStorage(directory: string): StorageService {
  const root = path.resolve(directory);

  function pathOf(storedName: string) {
    if (!storedNamePattern.test(storedName)) {
      throw new AppError("INVALID_FILE_NAME", 400, "That isn't the name of a stored file.");
    }
    return path.join(root, storedName);
  }

  return {
    async save({ tempPath, extension }) {
      if (!extensionPattern.test(extension)) {
        throw new Error(`The extension "${extension}" can't be used in a stored name.`);
      }
      const storedName = `${randomUUID()}${extension}`;
      const target = path.join(root, storedName);

      await mkdir(root, { recursive: true });
      try {
        await rename(tempPath, target);
      } catch (error) {
        // the temp file is on another drive, so copy it over and remove the original
        if (errorCode(error) !== "EXDEV") throw error;
        await copyFile(tempPath, target);
        await unlink(tempPath);
      }
      return { storedName };
    },

    async remove(storedName) {
      try {
        await unlink(pathOf(storedName));
      } catch (error) {
        if (errorCode(error) !== "ENOENT") throw error;
      }
    },

    async stream(storedName) {
      const file = pathOf(storedName);
      try {
        await stat(file);
      } catch (error) {
        if (errorCode(error) === "ENOENT") throw new AppError("FILE_NOT_FOUND", 404, "That file doesn't exist.");
        throw error;
      }
      return createReadStream(file);
    },
  };
}

// the folder is created the first time a file is saved
export const storage = createDiskStorage(env.UPLOAD_DIR);
