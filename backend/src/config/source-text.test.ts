// No file of the project may contain the invisible characters that set the direction of text (U+202A to U+202E and
// U+2066 to U+2069). In source code they can make a line read differently from what it does, and in a README or a
// name they can fool a reader. When one is needed, write it as an escape like \u202E, which can be seen. This asks git
// for the files, so it skips when the tests run somewhere that has no git repository.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repository = path.resolve(import.meta.dirname, "../../..");

function trackedFiles(): string[] | null {
  try {
    const list = execFileSync("git", ["ls-files", "-z"], { cwd: repository, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return list.split("\0").filter(Boolean);
  } catch {
    return null;
  }
}

const files = trackedFiles();
const textFile = /\.(ts|tsx|js|mjs|cjs|json|md|css|html|yml|yaml)$/i;
const directionCharacters = /[\u202A-\u202E\u2066-\u2069]/;

describe.skipIf(files === null)("the text of the project", () => {
  it("has no invisible direction characters in any file", () => {
    const offenders = (files ?? [])
      .filter((file) => textFile.test(file) && !file.endsWith("pnpm-lock.yaml"))
      .filter((file) => directionCharacters.test(readFileSync(path.join(repository, file), "utf8")));

    expect(offenders).toEqual([]);
  });

  it("looks at the files of the backend and the frontend, so it would find one", () => {
    const looked = (files ?? []).filter((file) => textFile.test(file));

    expect(looked.some((file) => file.startsWith("backend/src/"))).toBe(true);
    expect(looked.some((file) => file.startsWith("frontend/src/"))).toBe(true);
    expect(looked).toContain("README.md");
  });
});
