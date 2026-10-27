import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

window.scrollTo = vi.fn();

// No test talks to a real server. Unless a test sets up its own answer, every API call gets a "not found",
// which is also what the pages see while the real endpoints do not exist yet.
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "Not found.", details: [] } }), { status: 404 })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
  document.title = "";
});
