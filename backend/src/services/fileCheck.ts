// The rules for which files we accept as brand assets: PDF, AI, EPS and PNG.
// A file only passes when three things agree: its extension, the type the browser said it is,
// and its first bytes. Only the extension is taken from the name the person gave the file.
import { open } from "node:fs/promises";
import path from "node:path";

export type FileProblem = "unsupported-type" | "content-mismatch" | "empty";

export type FileCheck = { ok: true; extension: string } | { ok: false; problem: FileProblem };

interface FileRule {
  // the types browsers and operating systems really report for this kind of file
  mimeTypes: string[];
  // the file has to start with one of these
  signatures: Buffer[];
}

const PDF = Buffer.from("%PDF-");
const POSTSCRIPT = Buffer.from("%!");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const fileRules: Record<string, FileRule> = {
  ".pdf": { mimeTypes: ["application/pdf", "application/x-pdf"], signatures: [PDF] },
  // newer Illustrator files are PDF compatible and older ones are PostScript.
  // Systems without Illustrator often report them as octet-stream, the first bytes still have to match
  ".ai": {
    mimeTypes: [
      "application/pdf",
      "application/postscript",
      "application/illustrator",
      "application/vnd.adobe.illustrator",
      "application/x-illustrator",
      "application/octet-stream",
    ],
    signatures: [PDF, POSTSCRIPT],
  },
  ".eps": {
    mimeTypes: ["application/postscript", "application/eps", "application/x-eps", "image/eps", "image/x-eps", "application/octet-stream"],
    signatures: [POSTSCRIPT],
  },
  ".png": { mimeTypes: ["image/png"], signatures: [PNG] },
};

export const allowedExtensions = Object.keys(fileRules);

const longestSignature = Math.max(...Object.values(fileRules).flatMap((rule) => rule.signatures.map((s) => s.length)));

// the part after the last dot, in lower case. This is the only thing we use from the original name.
export function extensionOf(originalName: string): string {
  return path.extname(originalName).toLowerCase();
}

async function readStart(filePath: string): Promise<Buffer> {
  const handle = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(longestSignature);
    const { bytesRead } = await handle.read(buffer, 0, longestSignature, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

interface FileToCheck {
  originalName: string;
  // the type the browser reported, like "application/pdf; charset=binary"
  mimeType: string;
  size: number;
  // where the file is on disk right now
  path: string;
}

export async function checkFile(file: FileToCheck): Promise<FileCheck> {
  const extension = extensionOf(file.originalName);
  if (!Object.hasOwn(fileRules, extension)) return { ok: false, problem: "unsupported-type" };
  const rule = fileRules[extension];

  const mimeType = file.mimeType.split(";")[0].trim().toLowerCase();
  if (!rule.mimeTypes.includes(mimeType)) return { ok: false, problem: "unsupported-type" };

  if (file.size === 0) return { ok: false, problem: "empty" };

  const start = await readStart(file.path);
  const matches = rule.signatures.some((signature) => start.subarray(0, signature.length).equals(signature));
  if (!matches) return { ok: false, problem: "content-mismatch" };

  return { ok: true, extension };
}
