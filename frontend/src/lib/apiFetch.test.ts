import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch } from "./apiFetch";
import { getAuthToken, setAuthToken } from "./authToken";

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

describe("apiFetch: the token", () => {
  it("is sent when the call asks for it and there is one", async () => {
    setAuthToken("abc.def.ghi");
    const fetchMock = answer("{}");

    await apiFetch("/b2b/requests", { lang: "en", auth: true });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toEqual({ Accept: "application/json", "Accept-Language": "en", Authorization: "Bearer abc.def.ghi" });
  });

  it("is never sent by a public call, even when there is one", async () => {
    setAuthToken("abc.def.ghi");
    const fetchMock = answer("{}");

    await apiFetch("/products", { lang: "en" });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).not.toHaveProperty("Authorization");
  });
});

describe("apiFetch: the message of the server", () => {
  it("is in the ApiError, with its code, when the error answer has the usual shape", async () => {
    answer(JSON.stringify({ error: { code: "RATE_LIMITED", message: "Please try again in an hour.", details: [] } }), 429);

    const error = await failure(apiFetch("/b2b/requests", { lang: "en", auth: true }));

    expect([error.status, error.code, error.message]).toEqual([429, "RATE_LIMITED", "Please try again in an hour."]);
  });

  it("is not made up when the answer has no message", async () => {
    answer("<html>Bad gateway</html>", 502);

    const error = await failure(apiFetch("/products", { lang: "en" }));

    expect([error.status, error.code, error.message]).toEqual([502, undefined, "The server answered 502."]);
  });
});

describe("apiFetch: sending JSON", () => {
  it("sends the method and the body as JSON, with the token when asked", async () => {
    setAuthToken("abc.def.ghi");
    const fetchMock = answer('{"ok":true}');

    const body = await apiFetch<{ ok: boolean }>("/users/me", { lang: "es", method: "PATCH", json: { name: "Isabel" }, auth: true });

    expect(body).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/users/me");
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe('{"name":"Isabel"}');
    expect(init.headers).toEqual({ Accept: "application/json", "Accept-Language": "es", Authorization: "Bearer abc.def.ghi", "Content-Type": "application/json" });
  });

  it("sends nothing but the usual headers for a read, and no body", async () => {
    const fetchMock = answer("{}");

    await apiFetch("/products", { lang: "en" });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init).not.toHaveProperty("method");
    expect(init).not.toHaveProperty("body");
    expect(init.headers).not.toHaveProperty("Content-Type");
  });

  it("answers with nothing for a 204", async () => {
    answer(null, 204);

    expect(await apiFetch("/users/me/addresses/1", { lang: "en", method: "DELETE", auth: true })).toBeUndefined();
  });

  it("keeps the details of an error answer, for each field", async () => {
    answer(
      JSON.stringify({
        error: {
          code: "VALIDATION_ERROR",
          message: "Please enter your name.",
          details: [{ field: "name", message: "Please enter your name." }, { field: "quantity", available: 6 }, "junk", null, { field: 5 }],
        },
      }),
      400,
    );

    const error = await failure(apiFetch("/auth/register", { lang: "en", method: "POST", json: {} }));

    expect(error).toMatchObject({ status: 400, code: "VALIDATION_ERROR" });
    expect(error.details).toEqual([{ field: "name", message: "Please enter your name." }, { field: "quantity", available: 6 }, {}]);
  });

  it("has no details when the answer is not in the usual shape", async () => {
    answer("<html>Bad gateway</html>", 502);

    expect((await failure(apiFetch("/products", { lang: "en" }))).details).toEqual([]);
  });
});

describe("apiFetch: a token that ran out", () => {
  const expired = () => new Response(JSON.stringify({ error: { code: "TOKEN_EXPIRED", message: "Your session ran out. Please sign in again.", details: [] } }), { status: 401 });
  const newSession = () =>
    new Response(
      JSON.stringify({
        user: { id: "1", email: "a@b.co", name: "A", role: "user", accountType: "retail", preferredLanguage: "en", marketingEmails: false, createdAt: "2026-01-01T00:00:00.000Z" },
        accessToken: "new.token.value",
        expiresIn: 900,
      }),
      { status: 200 },
    );

  // answers like the server: the old token is refused, the refresh gives a new one, and the new one is accepted
  function server(options: { refresh?: () => Response } = {}) {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/auth/refresh") return (options.refresh ?? newSession)();
      const sent = (init?.headers as Record<string, string>).Authorization;
      return sent === "Bearer new.token.value" ? new Response('{"ok":true}', { status: 200 }) : expired();
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("is renewed with the refresh cookie, and the call runs again with the new token", async () => {
    setAuthToken("old.token.value");
    const fetchMock = server();

    const body = await apiFetch("/b2b/requests", { lang: "en", auth: true });

    expect(body).toEqual({ ok: true });
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual(["/api/b2b/requests", "/api/auth/refresh", "/api/b2b/requests"]);
    expect(getAuthToken()).toBe("new.token.value");
  });

  it("asks for the new token with a POST that carries no token of its own and no body", async () => {
    setAuthToken("old.token.value");
    const fetchMock = server();

    await apiFetch("/b2b/requests", { lang: "en", auth: true });

    const [, init] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ Accept: "application/json" });
    expect(init.body).toBeUndefined();
  });

  it("gives the first answer, and no token, when the sign in has ended too", async () => {
    vi.useFakeTimers();
    setAuthToken("old.token.value");
    const fetchMock = server({ refresh: () => new Response(JSON.stringify({ error: { code: "SESSION_EXPIRED", message: "Your session ended." } }), { status: 401 }) });

    const pending = failure(apiFetch("/b2b/requests", { lang: "en", auth: true }));
    await vi.advanceTimersByTimeAsync(1000);
    const error = await pending;

    expect(error).toMatchObject({ status: 401, code: "TOKEN_EXPIRED" });
    expect(getAuthToken()).toBeNull();
    // the refresh was asked twice (a second tab may have swapped the cookie), the call itself only once
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual(["/api/b2b/requests", "/api/auth/refresh", "/api/auth/refresh"]);
  });

  it("gives the first answer when the server cannot be reached for the renewal", async () => {
    setAuthToken("old.token.value");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/auth/refresh") throw new TypeError("Failed to fetch");
      return expired();
    });
    vi.stubGlobal("fetch", fetchMock);

    const error = await failure(apiFetch("/b2b/requests", { lang: "en", auth: true }));

    expect(error).toMatchObject({ status: 401, code: "TOKEN_EXPIRED" });
  });

  it("runs the call only once more, so a server that keeps saying no cannot start a loop", async () => {
    setAuthToken("old.token.value");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => (String(input) === "/api/auth/refresh" ? newSession() : expired()));
    vi.stubGlobal("fetch", fetchMock);

    const error = await failure(apiFetch("/b2b/requests", { lang: "en", auth: true }));

    expect(error.code).toBe("TOKEN_EXPIRED");
    expect(fetchMock.mock.calls.filter((call) => String(call[0]) === "/api/b2b/requests")).toHaveLength(2);
  });

  it("is not tried for any other 401, or for another status", async () => {
    for (const [status, code] of [
      [401, "UNAUTHENTICATED"],
      [403, "FORBIDDEN"],
      [500, "INTERNAL_ERROR"],
    ] as const) {
      setAuthToken("old.token.value");
      const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { code, message: "No." } }), { status }));
      vi.stubGlobal("fetch", fetchMock);

      const error = await failure(apiFetch("/b2b/requests", { lang: "en", auth: true }));

      expect(error.code).toBe(code);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  });

  it("is not tried for a public call", async () => {
    const fetchMock = vi.fn(async () => expired());
    vi.stubGlobal("fetch", fetchMock);

    await failure(apiFetch("/products", { lang: "en" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("is renewed once for several calls that ran out at the same moment", async () => {
    setAuthToken("old.token.value");
    const fetchMock = server();

    const answers = await Promise.all([apiFetch("/a", { lang: "en", auth: true }), apiFetch("/b", { lang: "en", auth: true }), apiFetch("/c", { lang: "en", auth: true })]);

    expect(answers).toHaveLength(3);
    expect(fetchMock.mock.calls.filter((call) => String(call[0]) === "/api/auth/refresh")).toHaveLength(1);
  });
});
