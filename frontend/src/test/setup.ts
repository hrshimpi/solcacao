import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { setAuthToken } from "../lib/authToken";
import { installFakeServer } from "./fakeServer";
import { installFakeXhr } from "./fakeXhr";

window.scrollTo = vi.fn();

// No test talks to a real server. Unless a test sets up its own answer, the API calls go to a fake server that knows the
// products, the carts and the accounts (an address it does not know gets a "not found"). Uploads go through XMLHttpRequest.
beforeEach(() => {
  installFakeXhr();
  installFakeServer();
});

afterEach(() => {
  cleanup();
  setAuthToken(null);
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
  document.title = "";
});
