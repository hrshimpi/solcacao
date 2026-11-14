import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { allowedExtensions, checkFile, extensionOf } from "./fileCheck.ts";

const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n");
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("rest of the picture")]);
const postscript = Buffer.from("%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 100 100\n");

let dir: string;
let count = 0;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "solcacao-filecheck-"));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

// writes the content to a real file and checks it as if it had been uploaded with this name and type
async function check(originalName: string, mimeType: string, content: Buffer) {
  const file = path.join(dir, `file-${count++}`);
  await writeFile(file, content);
  return checkFile({ originalName, mimeType, size: content.length, path: file });
}

describe("extensionOf", () => {
  it("returns the last extension in lower case", () => {
    expect(extensionOf("Logo.PNG")).toBe(".png");
    expect(extensionOf("logo.png.exe")).toBe(".exe");
    expect(extensionOf("my.brand.file.pdf")).toBe(".pdf");
  });

  it("only looks at the end, whatever the name does with folders", () => {
    expect(extensionOf("../../logo.png")).toBe(".png");
    expect(extensionOf("..\\..\\logo.png")).toBe(".png");
    expect(extensionOf("C:\\Users\\me\\logo.pdf")).toBe(".pdf");
  });

  it("gives nothing for names without an extension", () => {
    expect(extensionOf("logo")).toBe("");
    expect(extensionOf(".png")).toBe("");
    expect(extensionOf("")).toBe("");
  });
});

describe("checkFile: accepted files", () => {
  it("knows the four extensions", () => {
    expect([...allowedExtensions].sort()).toEqual([".ai", ".eps", ".pdf", ".png"]);
  });

  it("accepts a PDF", async () => {
    expect(await check("brand-guide.pdf", "application/pdf", pdf)).toEqual({ ok: true, extension: ".pdf" });
  });

  it("accepts a PNG", async () => {
    expect(await check("logo.png", "image/png", png)).toEqual({ ok: true, extension: ".png" });
  });

  it.each(["application/pdf", "application/postscript", "application/illustrator", "application/vnd.adobe.illustrator", "application/octet-stream"])(
    "accepts an Illustrator file that is PDF compatible, reported as %s",
    async (mimeType) => {
      expect(await check("label.ai", mimeType, pdf)).toEqual({ ok: true, extension: ".ai" });
    },
  );

  it("accepts an older Illustrator file that is PostScript", async () => {
    expect(await check("label.ai", "application/postscript", postscript)).toEqual({ ok: true, extension: ".ai" });
  });

  it.each(["application/postscript", "application/eps", "application/x-eps", "image/eps", "image/x-eps", "application/octet-stream"])(
    "accepts an EPS file reported as %s",
    async (mimeType) => {
      expect(await check("label.eps", mimeType, postscript)).toEqual({ ok: true, extension: ".eps" });
    },
  );

  it("does not care about upper case in the extension or the type, or extra parts after the type", async () => {
    expect(await check("LOGO.PNG", "IMAGE/PNG", png)).toEqual({ ok: true, extension: ".png" });
    expect(await check("guide.pdf", "application/pdf; charset=binary", pdf)).toEqual({ ok: true, extension: ".pdf" });
  });
});

describe("checkFile: wrong extension", () => {
  it.each(["notes.txt", "photo.jpg", "photo.jpeg", "doc.docx", "run.exe", "page.html", "script.js", "archive.zip", "vector.svg", "logo", ".png", "logo.png.", "logo.png "])(
    "refuses %j",
    async (name) => {
      expect(await check(name, "application/pdf", pdf)).toEqual({ ok: false, problem: "unsupported-type" });
    },
  );

  it("looks at the last extension, so a double extension does not get through", async () => {
    expect(await check("logo.png.exe", "image/png", png)).toEqual({ ok: false, problem: "unsupported-type" });
    expect(await check("logo.exe.png", "image/png", png)).toEqual({ ok: true, extension: ".png" });
  });
});

describe("checkFile: wrong type reported", () => {
  it("refuses a good extension with a type that does not belong to it", async () => {
    expect(await check("logo.png", "text/html", png)).toEqual({ ok: false, problem: "unsupported-type" });
    expect(await check("logo.png", "application/pdf", png)).toEqual({ ok: false, problem: "unsupported-type" });
    expect(await check("guide.pdf", "application/octet-stream", pdf)).toEqual({ ok: false, problem: "unsupported-type" });
    expect(await check("guide.pdf", "", pdf)).toEqual({ ok: false, problem: "unsupported-type" });
  });
});

describe("checkFile: wrong content", () => {
  it("refuses a file that does not start like its extension says", async () => {
    expect(await check("logo.png", "image/png", Buffer.from("<html><script>alert(1)</script></html>"))).toEqual({ ok: false, problem: "content-mismatch" });
    expect(await check("guide.pdf", "application/pdf", Buffer.from("just some text"))).toEqual({ ok: false, problem: "content-mismatch" });
    expect(await check("label.eps", "application/postscript", Buffer.from("MZ\x90\x00 an exe"))).toEqual({ ok: false, problem: "content-mismatch" });
    expect(await check("label.ai", "application/illustrator", Buffer.from("hello"))).toEqual({ ok: false, problem: "content-mismatch" });
  });

  it("refuses a real file of another kind with the wrong extension", async () => {
    expect(await check("guide.pdf", "application/pdf", png)).toEqual({ ok: false, problem: "content-mismatch" });
    expect(await check("logo.png", "image/png", pdf)).toEqual({ ok: false, problem: "content-mismatch" });
    expect(await check("label.eps", "application/postscript", pdf)).toEqual({ ok: false, problem: "content-mismatch" });
  });

  it("needs the whole signature, not just the first byte", async () => {
    expect(await check("logo.png", "image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toEqual({ ok: false, problem: "content-mismatch" });
    expect(await check("guide.pdf", "application/pdf", Buffer.from("%PDF"))).toEqual({ ok: false, problem: "content-mismatch" });
  });

  it("refuses an empty file", async () => {
    expect(await check("logo.png", "image/png", Buffer.alloc(0))).toEqual({ ok: false, problem: "empty" });
  });
});
