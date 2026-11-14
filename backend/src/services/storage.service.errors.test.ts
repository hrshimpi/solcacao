// What the disk storage does when the disk itself says no. The real disk rarely does, so the file system calls that
// matter are replaced here by ones that fail in a chosen way (the other tests of the storage use the real disk).
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fsFailures = vi.hoisted(() => ({
  rename: undefined as undefined | ((from: string, to: string) => Promise<void>),
  stat: undefined as undefined | ((file: string) => Promise<unknown>),
  copyFile: undefined as undefined | ((from: string, to: string) => Promise<void>),
}));

vi.mock("node:fs/promises", async () => {
  const real = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...real,
    rename: (from: string, to: string) => (fsFailures.rename ? fsFailures.rename(from, to) : real.rename(from, to)),
    stat: (file: string, ...rest: unknown[]) => (fsFailures.stat ? fsFailures.stat(file) : (real.stat as (...args: unknown[]) => unknown)(file, ...rest)),
    copyFile: (from: string, to: string) => (fsFailures.copyFile ? fsFailures.copyFile(from, to) : real.copyFile(from, to)),
  };
});

// imported after the mock is set up
const { createDiskStorage } = await import("./storage.service.ts");

const failing = (code: string) => Object.assign(new Error(`${code}: the disk said no`), { code });

let base: string;
let root: string;

beforeEach(async () => {
  base = await mkdtemp(path.join(tmpdir(), "solcacao-storage-errors-"));
  root = path.join(base, "store");
});

afterEach(async () => {
  fsFailures.rename = undefined;
  fsFailures.stat = undefined;
  fsFailures.copyFile = undefined;
  await rm(base, { recursive: true, force: true });
});

async function waitingFile(content = "the bytes of the file") {
  const tempPath = path.join(base, "waiting");
  await writeFile(tempPath, content);
  return tempPath;
}

describe("disk storage: save when the temp folder is on another drive", () => {
  it("copies the file over and removes the original, so the file is stored all the same", async () => {
    const storage = createDiskStorage(root);
    const tempPath = await waitingFile("bytes from another drive");
    fsFailures.rename = async () => {
      throw failing("EXDEV");
    };

    const { storedName } = await storage.save({ tempPath, extension: ".pdf", mimeType: "application/pdf" });

    expect(await readFile(path.join(root, storedName), "utf8")).toBe("bytes from another drive");
    expect(await readdir(base)).not.toContain("waiting");
  });

  it("fails, and leaves the original where it was, when the copy fails too", async () => {
    const storage = createDiskStorage(root);
    const tempPath = await waitingFile();
    fsFailures.rename = async () => {
      throw failing("EXDEV");
    };
    fsFailures.copyFile = async () => {
      throw failing("ENOSPC");
    };

    await expect(storage.save({ tempPath, extension: ".pdf", mimeType: "application/pdf" })).rejects.toMatchObject({ code: "ENOSPC" });

    expect(await readFile(tempPath, "utf8")).toBe("the bytes of the file");
  });
});

describe("disk storage: save when the disk says no", () => {
  it.each(["EACCES", "ENOSPC", "EROFS", "EMFILE"])("fails with %s instead of pretending the file was stored", async (code) => {
    const storage = createDiskStorage(root);
    const tempPath = await waitingFile();
    fsFailures.rename = async () => {
      throw failing(code);
    };

    await expect(storage.save({ tempPath, extension: ".pdf", mimeType: "application/pdf" })).rejects.toMatchObject({ code });

    // nothing was stored, and the waiting file is still there for the upload middleware to clean up
    expect((await readdir(root)).filter((name) => name !== "waiting")).toEqual([]);
    expect(await readdir(base)).toContain("waiting");
  });
});

describe("disk storage: stream when the disk says no", () => {
  it.each(["EACCES", "EMFILE", "EIO", "ENOTDIR"])("passes on %s, and does not say the file is missing", async (code) => {
    const storage = createDiskStorage(root);
    fsFailures.stat = async () => {
      throw failing(code);
    };

    await expect(storage.stream("11111111-2222-3333-4444-555555555555.pdf")).rejects.toMatchObject({ code });
  });

  it("only says 404 when the file is really not there", async () => {
    const storage = createDiskStorage(root);
    fsFailures.stat = async () => {
      throw failing("ENOENT");
    };

    await expect(storage.stream("11111111-2222-3333-4444-555555555555.pdf")).rejects.toMatchObject({ code: "FILE_NOT_FOUND", status: 404 });
  });
});

describe("disk storage: remove when the disk says no", () => {
  it("does not hide a problem other than a missing file", async () => {
    const storage = createDiskStorage(root);
    // a folder with the name of a stored file cannot be removed like a file
    const name = "11111111-2222-3333-4444-555555555555.pdf";
    await mkdir(path.join(root, name), { recursive: true });

    await expect(storage.remove(name)).rejects.toBeDefined();
  });
});
