import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch } from "./apiFetch";

// runs a call that is expected to fail and returns the error it threw
async function failure(call: Promise<unknown>): Promise<ApiError> {
  try {
    await call;
  } catch (error) {
    return error as ApiError;
  }
  throw new Error("the call should have failed");
}

function answer(body: BodyInit | null, status = 200) {
  const fetchMock = vi.fn(async () => new Response(body, { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("apiFetch: the request", () => {
  it("asks for JSON in the current language, with the query in the order it was given", async () => {
    const fetchMock = answer("{}");

    await apiFetch("/products", { lang: "es", query: { featured: true, limit: 5 } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/products?featured=true&limit=5");
    expect(init.headers).toEqual({ Accept: "application/json", "Accept-Language": "es" });
  });

  it("leaves out empty query values, and the question mark when nothing is left", async () => {
    const fetchMock = answer("{}");

    await apiFetch("/products", { lang: "en", query: { q: undefined, page: 2 } });
    await apiFetch("/health", { lang: "en" });

    expect(fetchMock.mock.calls.map((call) => (call as unknown[])[0])).toEqual(["/api/products?page=2", "/api/health"]);
  });

  it("encodes values that need it", async () => {
    const fetchMock = answer("{}");

    await apiFetch("/products", { lang: "en", query: { q: "dark & bitter" } });

    expect((fetchMock.mock.calls[0] as unknown[])[0]).toBe("/api/products?q=dark+%26+bitter");
  });
});

describe("apiFetch: the answer", () => {
  it("returns the parsed JSON", async () => {
    answer(JSON.stringify({ items: [1, 2, 3] }));

    expect(await apiFetch("/products", { lang: "en" })).toEqual({ items: [1, 2, 3] });
  });

  it.each([400, 404, 500, 503])("throws an ApiError with the status for a %i answer", async (status) => {
    answer(JSON.stringify({ error: { code: "NOPE" } }), status);

    const error = await failure(apiFetch("/products", { lang: "en" }));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(status);
    expect(error.message).toBe(`The server answered ${status}.`);
  });

  it("throws an ApiError when the answer is not JSON, even with a 200", async () => {
    answer("<!doctype html><html></html>");

    const error = await failure(apiFetch("/products", { lang: "en" }));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe("The answer was not valid JSON.");
  });

  it("throws an ApiError with status 0 when the server cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const error = await failure(apiFetch("/products", { lang: "en" }));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.message).toBe("The server could not be reached.");
  });
});

// a fetch that never answers, but gives up when it is told to
function hangingFetch() {
  const fetchMock = vi.fn(
    (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("apiFetch: cancelling and waiting", () => {
  it("gives up after the timeout", async () => {
    vi.useFakeTimers();
    hangingFetch();

    const result = failure(apiFetch("/products", { lang: "en", timeoutMs: 3000 }));
    await vi.advanceTimersByTimeAsync(2999);
    let settled = false;
    void result.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    const error = await result;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe("The server could not be reached.");
  });

  it("stops when the caller cancels, and says so", async () => {
    hangingFetch();
    const controller = new AbortController();

    const result = failure(apiFetch("/products", { lang: "en", signal: controller.signal }));
    controller.abort();

    const error = await result;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe("The request was cancelled.");
  });

  it("does not even start when the signal is already cancelled", async () => {
    hangingFetch();
    const controller = new AbortController();
    controller.abort();

    const error = await failure(apiFetch("/products", { lang: "en", signal: controller.signal }));

    expect(error.message).toBe("The request was cancelled.");
  });

  it("does not leave its timer running after an answer", async () => {
    vi.useFakeTimers();
    answer("{}");

    await apiFetch("/products", { lang: "en" });

    expect(vi.getTimerCount()).toBe(0);
  });
});
