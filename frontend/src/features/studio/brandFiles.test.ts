import { addBrandFiles } from "./brandFiles";
import { MAX_FILE_MB, MAX_FILES } from "./studioOptions";

const MB = 1024 * 1024;

function makeFile(name: string, size = 10, lastModified = 1000) {
  const file = new File(["x"], name, { lastModified });
  // the size is set directly, so a file over the limit does not need that much memory
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("addBrandFiles", () => {
  it.each(["logo.pdf", "logo.ai", "logo.eps", "logo.png"])("accepts %s", (name) => {
    const { files, problems } = addBrandFiles([], [makeFile(name)]);

    expect(files.map((file) => file.name)).toEqual([name]);
    expect(problems).toEqual([]);
  });

  it("does not mind capital letters in the extension", () => {
    const { files, problems } = addBrandFiles([], [makeFile("LOGO.PDF"), makeFile("Mark.Png")]);

    expect(files).toHaveLength(2);
    expect(problems).toEqual([]);
  });

  it.each(["notes.txt", "photo.jpg", "brief.docx", "run.exe", "vector.svg"])("rejects %s because of its type", (name) => {
    const { files, problems } = addBrandFiles([], [makeFile(name)]);

    expect(files).toEqual([]);
    expect(problems).toEqual([{ reason: "type", name }]);
  });

  it("looks at the real extension, not at a part of the name", () => {
    const { files, problems } = addBrandFiles([], [makeFile("logo.pdf.exe"), makeFile("pdf"), makeFile("png"), makeFile(".png.zip")]);

    expect(files).toEqual([]);
    expect(problems.map((problem) => problem.reason)).toEqual(["type", "type", "type", "type"]);
  });

  it("rejects an empty file", () => {
    const { files, problems } = addBrandFiles([], [makeFile("empty.pdf", 0)]);

    expect(files).toEqual([]);
    expect(problems).toEqual([{ reason: "empty", name: "empty.pdf" }]);
  });

  it("accepts a file of exactly the size limit and rejects one byte more", () => {
    const { files, problems } = addBrandFiles([], [makeFile("exact.pdf", MAX_FILE_MB * MB), makeFile("over.pdf", MAX_FILE_MB * MB + 1)]);

    expect(files.map((file) => file.name)).toEqual(["exact.pdf"]);
    expect(problems).toEqual([{ reason: "size", name: "over.pdf" }]);
  });

  it("keeps at most five files and names the ones that did not fit", () => {
    const incoming = Array.from({ length: 7 }, (_, index) => makeFile(`file-${index + 1}.pdf`));

    const { files, problems } = addBrandFiles([], incoming);

    expect(MAX_FILES).toBe(5);
    expect(files.map((file) => file.name)).toEqual(["file-1.pdf", "file-2.pdf", "file-3.pdf", "file-4.pdf", "file-5.pdf"]);
    expect(problems).toEqual([
      { reason: "count", name: "file-6.pdf" },
      { reason: "count", name: "file-7.pdf" },
    ]);
  });

  it("counts the files that were added before", () => {
    const current = [makeFile("a.pdf"), makeFile("b.pdf"), makeFile("c.pdf"), makeFile("d.pdf")];

    const { files, problems } = addBrandFiles(current, [makeFile("e.pdf"), makeFile("f.pdf")]);

    expect(files).toHaveLength(5);
    expect(problems).toEqual([{ reason: "count", name: "f.pdf" }]);
  });

  it("keeps a file once when the same file is chosen again, without a message", () => {
    const first = makeFile("logo.pdf", 20, 5000);

    const { files, problems } = addBrandFiles([first], [makeFile("logo.pdf", 20, 5000)]);

    expect(files).toEqual([first]);
    expect(problems).toEqual([]);
  });

  it("keeps two different files that have the same name", () => {
    const { files } = addBrandFiles([makeFile("logo.pdf", 20)], [makeFile("logo.pdf", 30)]);

    expect(files).toHaveLength(2);
  });

  it("keeps the good files of a mixed choice and lists the bad ones in order", () => {
    const { files, problems } = addBrandFiles([], [makeFile("a.pdf"), makeFile("b.txt"), makeFile("c.png"), makeFile("d.ai", 0)]);

    expect(files.map((file) => file.name)).toEqual(["a.pdf", "c.png"]);
    expect(problems).toEqual([
      { reason: "type", name: "b.txt" },
      { reason: "empty", name: "d.ai" },
    ]);
  });

  it("does not change the list it was given", () => {
    const current = [makeFile("a.pdf")];

    addBrandFiles(current, [makeFile("b.pdf")]);

    expect(current).toHaveLength(1);
  });
});
