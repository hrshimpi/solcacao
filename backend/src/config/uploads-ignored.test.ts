// The uploaded brand files must never end up in git. This asks git itself, so it checks the rules as they really are
// in .gitignore (and skips when the tests run somewhere that has no git repository, like a copy of the files).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repository = path.resolve(import.meta.dirname, "../../..");

function git(...args: string[]) {
  return execFileSync("git", args, { cwd: repository, stdio: ["ignore", "pipe", "ignore"], encoding: "utf8" });
}

const inRepository = (() => {
  try {
    return git("rev-parse", "--is-inside-work-tree").trim() === "true";
  } catch {
    return false;
  }
})();

// git check-ignore -q: exit code 0 when the path is ignored, 1 when it is not
function isIgnored(file: string) {
  try {
    git("check-ignore", "-q", "--no-index", file);
    return true;
  } catch {
    return false;
  }
}

describe.skipIf(!inRepository)("the uploads folder and git", () => {
  it.each(["backend/uploads/brand-guide.pdf", "backend/uploads/11111111-2222-3333-4444-555555555555.png", "backend/uploads/tmp/some-half-sent-file", "uploads/logo.eps"])(
    "ignores %s",
    (file) => {
      expect(isIgnored(file)).toBe(true);
    },
  );

  it("ignores the folder that .env.example gives for UPLOAD_DIR", () => {
    const example = readFileSync(path.join(repository, "backend/.env.example"), "utf8");
    const dir = /^UPLOAD_DIR=(.+)$/m.exec(example)?.[1].trim();

    expect(dir).toBeDefined();
    expect(isIgnored(path.posix.join("backend", dir!, "a-file.pdf"))).toBe(true);
  });

  it("does not ignore the code that handles the uploads", () => {
    for (const file of ["backend/src/middleware/upload.ts", "backend/src/services/storage.service.ts", "backend/src/middleware/upload.test.ts", "frontend/src/features/studio/steps/AssetsStep.tsx"]) {
      expect(isIgnored(file), file).toBe(false);
    }
  });

  it("keeps no uploaded file in the repository", () => {
    const tracked = git("ls-files").split("\n").filter(Boolean);

    expect(tracked.filter((file) => /(^|\/)uploads\//.test(file))).toEqual([]);
  });
});
