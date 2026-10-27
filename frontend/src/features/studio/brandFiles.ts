// The rules for brand files, checked in the browser before anything is sent. The server checks them again.
import { allowedExtensions, MAX_FILE_MB, MAX_FILES } from "./studioOptions";

export interface FileProblem {
  reason: "type" | "empty" | "size" | "count";
  name: string;
}

// a name with no dot has no extension, so a file that is just called "pdf" is not a pdf
function extensionOf(name: string) {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

function isSameFile(a: File, b: File) {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

// adds the files that pass and lists the ones that do not, so the person can be told why
export function addBrandFiles(current: File[], incoming: File[]) {
  const files = [...current];
  const problems: FileProblem[] = [];

  for (const file of incoming) {
    if (!allowedExtensions.includes(extensionOf(file.name))) {
      problems.push({ reason: "type", name: file.name });
    } else if (file.size === 0) {
      problems.push({ reason: "empty", name: file.name });
    } else if (file.size > MAX_FILE_MB * 1024 * 1024) {
      problems.push({ reason: "size", name: file.name });
    } else if (files.some((item) => isSameFile(item, file))) {
      // the same file chosen twice is only kept once, and that is not a mistake worth a message
      continue;
    } else if (files.length >= MAX_FILES) {
      problems.push({ reason: "count", name: file.name });
    } else {
      files.push(file);
    }
  }

  return { files, problems };
}
