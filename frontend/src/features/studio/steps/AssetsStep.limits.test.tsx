// The edges of the files step: dragging, an empty drop, the limit of five files when some are removed, and the same
// file chosen again. The ordinary choices and the messages are tested in AssetsStep.test.tsx.
import { createEvent, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { renderPiece } from "../../../test/renderAt";
import AssetsStep from "./AssetsStep";

function makeFile(name: string, size = 2048, lastModified = 1000) {
  const file = new File(["x"], name, { type: "application/octet-stream", lastModified });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function Parent({ onFiles }: { onFiles?: (files: File[]) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  return (
    <AssetsStep
      files={files}
      onChange={(next) => {
        setFiles(next);
        onFiles?.(next);
      }}
    />
  );
}

const fileInput = () => document.querySelector<HTMLInputElement>("input[type=file]")!;
const zone = () => screen.getByText("Drag files here or choose a file").parentElement!;
const pick = () => userEvent.setup({ applyAccept: false });

describe("dragging over the drop area", () => {
  it("lights it up while a file is over it, and puts it back when the file leaves", () => {
    renderPiece(<Parent />);
    expect(zone().className).not.toContain("bg-pod-wine/5");

    fireEvent.dragOver(zone());
    expect(zone().className).toContain("bg-pod-wine/5");

    fireEvent.dragLeave(zone());
    expect(zone().className).not.toContain("bg-pod-wine/5");
  });

  it("puts it back after a drop too", () => {
    renderPiece(<Parent />);
    fireEvent.dragOver(zone());

    fireEvent.drop(zone(), { dataTransfer: { files: [makeFile("logo.png")] } });

    expect(zone().className).not.toContain("bg-pod-wine/5");
  });

  it("asks the browser not to open the file itself, for the drag over and for the drop", () => {
    renderPiece(<Parent />);

    const over = createEvent.dragOver(zone());
    fireEvent(zone(), over);
    const drop = createEvent.drop(zone(), { dataTransfer: { files: [makeFile("logo.png")] } });
    fireEvent(zone(), drop);

    expect(over.defaultPrevented).toBe(true);
    expect(drop.defaultPrevented).toBe(true);
  });

  it("does nothing, and says nothing, when what was dropped has no files (like a piece of text)", () => {
    const seen: File[][] = [];
    renderPiece(<Parent onFiles={(files) => seen.push(files)} />);

    fireEvent.drop(zone(), { dataTransfer: { files: [] } });

    expect(seen).toEqual([]);
    expect(screen.queryByText("Selected files")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("refuses a dropped file that is not a brand file, the same as a chosen one", () => {
    renderPiece(<Parent />);

    fireEvent.drop(zone(), { dataTransfer: { files: [makeFile("notes.txt")] } });

    expect(screen.getAllByText("notes.txt is not a supported file. Use PDF, AI, EPS or PNG.").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Remove notes.txt" })).not.toBeInTheDocument();
  });

  it("takes files that are dropped one after the other", () => {
    renderPiece(<Parent />);

    fireEvent.drop(zone(), { dataTransfer: { files: [makeFile("a.pdf")] } });
    fireEvent.drop(zone(), { dataTransfer: { files: [makeFile("b.png"), makeFile("c.eps")] } });

    expect(screen.getAllByRole("button", { name: /^Remove / })).toHaveLength(3);
    expect(screen.getByText("(3 of 5 files)")).toBeInTheDocument();
  });
});

describe("the limit of five files", () => {
  const fiveFiles = ["a.pdf", "b.pdf", "c.pdf", "d.pdf", "e.pdf"].map((name) => makeFile(name));

  it("has room again when one is removed", async () => {
    const user = pick();
    renderPiece(<Parent />);
    await user.upload(fileInput(), fiveFiles);
    expect(screen.getByText("(5 of 5 files)")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove c.pdf" }));
    expect(screen.getByText("(4 of 5 files)")).toBeInTheDocument();
    await user.upload(fileInput(), makeFile("f.pdf"));

    expect(screen.getByRole("button", { name: "Remove f.pdf" })).toBeInTheDocument();
    expect(screen.getByText("(5 of 5 files)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove c.pdf" })).not.toBeInTheDocument();
  });

  it("refuses a sixth file, and does not change the five that are there", async () => {
    const user = pick();
    const seen: File[][] = [];
    renderPiece(<Parent onFiles={(files) => seen.push(files)} />);
    await user.upload(fileInput(), fiveFiles);
    const before = seen.length;

    await user.upload(fileInput(), makeFile("f.pdf"));

    expect(screen.getAllByText("You can add up to 5 files. f.pdf was not added.").length).toBeGreaterThan(0);
    expect(seen).toHaveLength(before);
    expect(screen.getAllByRole("button", { name: /^Remove / })).toHaveLength(5);
  });

  it("fills the last places and names only the files that did not fit, when several come at once", async () => {
    const user = pick();
    renderPiece(<Parent />);
    await user.upload(fileInput(), fiveFiles.slice(0, 3));

    await user.upload(fileInput(), [makeFile("x.png"), makeFile("y.png"), makeFile("z.png")]);

    expect(screen.getAllByRole("button", { name: /^Remove / })).toHaveLength(5);
    expect(screen.getAllByText("You can add up to 5 files. z.png was not added.").length).toBeGreaterThan(0);
    expect(screen.queryByText("You can add up to 5 files. y.png was not added.")).not.toBeInTheDocument();
  });

  it("counts the same file chosen twice once", async () => {
    const user = pick();
    renderPiece(<Parent />);

    await user.upload(fileInput(), makeFile("logo.png", 2048, 5000));
    await user.upload(fileInput(), makeFile("logo.png", 2048, 5000));

    expect(screen.getAllByRole("button", { name: /^Remove / })).toHaveLength(1);
    expect(screen.getByText("(1 of 5 files)")).toBeInTheDocument();
    expect(screen.queryByText(/not added/)).not.toBeInTheDocument();
  });

  it("keeps two files that have the same name but are not the same file", async () => {
    const user = pick();
    renderPiece(<Parent />);

    await user.upload(fileInput(), [makeFile("logo.png", 2048), makeFile("logo.png", 4096)]);

    expect(screen.getAllByRole("button", { name: "Remove logo.png" })).toHaveLength(2);
  });
});

describe("a name that is only an extension", () => {
  it.each([".png", ".pdf", ".eps", ".ai"])("refuses %s, as the server does", async (name) => {
    const user = pick();
    renderPiece(<Parent />);

    await user.upload(fileInput(), makeFile(name));

    expect(screen.getAllByText(`${name} is not a supported file. Use PDF, AI, EPS or PNG.`).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: `Remove ${name}` })).not.toBeInTheDocument();
  });
});
