import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { renderPiece } from "../../../test/renderAt";
import { MAX_FILE_MB } from "../studioOptions";
import AssetsStep from "./AssetsStep";

const MB = 1024 * 1024;

function makeFile(name: string, size = 2048) {
  const file = new File(["x"], name, { type: "application/octet-stream", lastModified: 1000 });
  // the size is set directly, so a file over the limit does not need that much memory
  Object.defineProperty(file, "size", { value: size });
  return file;
}

// the step keeps no files of its own, so a small parent holds them like the wizard does
function Parent({ start = [], onFiles }: { start?: File[]; onFiles?: (files: File[]) => void }) {
  const [files, setFiles] = useState<File[]>(start);
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

function fileInput() {
  return document.querySelector<HTMLInputElement>("input[type=file]")!;
}

// a real browser does not offer other file types in the picker, but a drop can bring anything
const pick = () => userEvent.setup({ applyAccept: false });

describe("AssetsStep", () => {
  it("shows the drop area with the formats and limits, and no files yet", () => {
    renderPiece(<Parent />);

    expect(screen.getByText("Drag files here or choose a file")).toBeInTheDocument();
    expect(screen.getByText("PDF, AI, EPS, PNG · Max 50 MB each · Up to 5 files")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose file" })).toBeInTheDocument();
    expect(screen.queryByText("Selected files")).not.toBeInTheDocument();
  });

  it("offers the four formats in the file picker", () => {
    renderPiece(<Parent />);

    expect(fileInput()).toHaveAttribute("accept", ".pdf,.ai,.eps,.png");
    expect(fileInput()).toHaveAttribute("multiple");
  });

  it("opens the file picker from the Choose file button", async () => {
    const user = userEvent.setup();
    renderPiece(<Parent />);
    const click = vi.spyOn(fileInput(), "click");

    await user.click(screen.getByRole("button", { name: "Choose file" }));

    expect(click).toHaveBeenCalledTimes(1);
  });

  it("lists a chosen file with its size and a remove button", async () => {
    const user = pick();
    const chosen: File[][] = [];
    renderPiece(<Parent onFiles={(files) => chosen.push(files)} />);

    await user.upload(fileInput(), makeFile("logo.pdf", 3 * MB));

    expect(screen.getByText("logo.pdf")).toBeInTheDocument();
    expect(screen.getByText("(3.0 MB)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove logo.pdf" })).toBeInTheDocument();
    expect(screen.getByText("(1 of 5 files)")).toBeInTheDocument();
    expect(chosen.at(-1)?.map((file) => file.name)).toEqual(["logo.pdf"]);
  });

  it("takes several files at once, EPS and AI included", async () => {
    const user = pick();
    renderPiece(<Parent />);

    await user.upload(fileInput(), [makeFile("mark.eps"), makeFile("pack.ai"), makeFile("label.png")]);

    const list = within(screen.getByRole("list"));
    expect(list.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Remove mark.eps" })).toBeInTheDocument();
    expect(screen.getByText("(3 of 5 files)")).toBeInTheDocument();
  });

  it("takes files that are dropped on the area", () => {
    renderPiece(<Parent />);
    const zone = screen.getByText("Drag files here or choose a file").parentElement!;

    fireEvent.drop(zone, { dataTransfer: { files: [makeFile("dropped.png")] } });

    expect(screen.getByRole("button", { name: "Remove dropped.png" })).toBeInTheDocument();
  });

  it("shows the files that were added before, for example when coming back to the step", () => {
    renderPiece(<Parent start={[makeFile("kept.pdf")]} />);

    expect(screen.getByText("kept.pdf")).toBeInTheDocument();
  });

  it("removes a file with its button", async () => {
    const user = pick();
    const chosen: File[][] = [];
    renderPiece(<Parent onFiles={(files) => chosen.push(files)} />);
    await user.upload(fileInput(), [makeFile("a.pdf"), makeFile("b.pdf")]);

    await user.click(screen.getByRole("button", { name: "Remove a.pdf" }));

    expect(screen.queryByText("a.pdf")).not.toBeInTheDocument();
    expect(screen.getByText("b.pdf")).toBeInTheDocument();
    expect(chosen.at(-1)?.map((file) => file.name)).toEqual(["b.pdf"]);
  });

  it("says a file is not supported and does not keep it", async () => {
    const user = pick();
    renderPiece(<Parent />);

    await user.upload(fileInput(), makeFile("notes.txt"));

    expect(screen.getAllByText("notes.txt is not a supported file. Use PDF, AI, EPS or PNG.").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Remove notes.txt" })).not.toBeInTheDocument();
  });

  it("says a file is too big", async () => {
    const user = pick();
    renderPiece(<Parent />);

    await user.upload(fileInput(), makeFile("huge.pdf", MAX_FILE_MB * MB + 1));

    expect(screen.getAllByText("huge.pdf is larger than 50 MB.").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Remove huge.pdf" })).not.toBeInTheDocument();
  });

  it("says a file is empty", async () => {
    const user = pick();
    renderPiece(<Parent />);

    await user.upload(fileInput(), makeFile("blank.pdf", 0));

    expect(screen.getAllByText("blank.pdf is empty.").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Remove blank.pdf" })).not.toBeInTheDocument();
  });

  it("stops at five files and says which one was not added", async () => {
    const user = pick();
    renderPiece(<Parent />);

    await user.upload(
      fileInput(),
      Array.from({ length: 6 }, (_, index) => makeFile(`file-${index + 1}.pdf`)),
    );

    expect(screen.getAllByText("You can add up to 5 files. file-6.pdf was not added.").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /^Remove / })).toHaveLength(5);
    expect(screen.getByText("(5 of 5 files)")).toBeInTheDocument();
  });

  it("keeps the good files of a choice that also has a bad one", async () => {
    const user = pick();
    renderPiece(<Parent />);

    await user.upload(fileInput(), [makeFile("good.pdf"), makeFile("bad.exe")]);

    expect(screen.getByRole("button", { name: "Remove good.pdf" })).toBeInTheDocument();
    expect(screen.getAllByText(/bad\.exe is not a supported file/).length).toBeGreaterThan(0);
  });

  it("clears the messages when the next choice is fine, and when a file is removed", async () => {
    const user = pick();
    renderPiece(<Parent />);
    await user.upload(fileInput(), makeFile("bad.exe"));
    expect(screen.getAllByText(/bad\.exe is not a supported file/).length).toBeGreaterThan(0);

    await user.upload(fileInput(), makeFile("good.pdf"));
    expect(screen.queryByText(/bad\.exe is not a supported file/)).not.toBeInTheDocument();

    await user.upload(fileInput(), makeFile("bad.exe"));
    await user.click(screen.getByRole("button", { name: "Remove good.pdf" }));
    expect(screen.queryByText(/bad\.exe is not a supported file/)).not.toBeInTheDocument();
  });

  it("ties the messages to the Choose file button for a screen reader", async () => {
    const user = pick();
    renderPiece(<Parent />);

    await user.upload(fileInput(), makeFile("notes.txt"));

    const description = screen.getByRole("button", { name: "Choose file" });
    expect(description).toHaveAccessibleDescription(/PDF, AI, EPS, PNG/);
    expect(description).toHaveAccessibleDescription(/notes\.txt is not a supported file/);
  });

  it("announces what was added and what was refused", async () => {
    const user = pick();
    renderPiece(<Parent />);

    await user.upload(fileInput(), [makeFile("good.pdf"), makeFile("bad.exe")]);

    expect(screen.getByRole("status")).toHaveTextContent("1 file added. bad.exe is not a supported file.");
  });

  it("announces a removed file", async () => {
    const user = pick();
    renderPiece(<Parent start={[makeFile("old.pdf")]} />);

    await user.click(screen.getByRole("button", { name: "Remove old.pdf" }));

    expect(screen.getByRole("status")).toHaveTextContent("old.pdf removed.");
  });

  it("is in Spanish on the Spanish address", async () => {
    const user = pick();
    renderPiece(<Parent />, "/es/wholesale/studio");
    expect(screen.getByText("PDF, AI, EPS, PNG · Máx. 50 MB cada uno · Hasta 5 archivos")).toBeInTheDocument();

    await user.upload(fileInput(), makeFile("notas.txt"));

    expect(screen.getAllByText("notas.txt no es un archivo compatible. Use PDF, AI, EPS o PNG.").length).toBeGreaterThan(0);
  });
});
