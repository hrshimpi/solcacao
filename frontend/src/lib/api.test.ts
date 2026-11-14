import { FakeXhr } from "../test/fakeXhr";
import { api } from "./api";
import { ApiError } from "./apiFetch";
import { TOKEN_STORAGE_KEY } from "./authToken";

const standardError = (code: string, message: string) => ({ error: { code, message, details: [] } });

// starts an upload and lets the test answer it
function start(options: Partial<Parameters<typeof api.upload>[2]> = {}, form = new FormData()) {
  FakeXhr.autoAnswer = null;
  const promise = api.upload<{ request: { id: string } }>("/b2b/quote", form, { lang: "en", ...options });
  // a rejection nobody waits for yet is not a problem of the test
  promise.catch(() => {});
  return { promise, xhr: FakeXhr.last };
}

async function failure(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error as ApiError;
  }
  throw new Error("the call should have failed");
}

describe("api.upload", () => {
  describe("the request", () => {
    it("posts the form to the address under /api", () => {
      const form = new FormData();
      form.append("companyName", "Hacienda Brands");

      const { xhr } = start({}, form);

      expect(xhr.method).toBe("POST");
      expect(xhr.url).toBe("/api/b2b/quote");
      expect(xhr.body).toBe(form);
    });

    it("asks for JSON in the language of the page", () => {
      const { xhr } = start({ lang: "es" });

      expect(xhr.headers.Accept).toBe("application/json");
      expect(xhr.headers["Accept-Language"]).toBe("es");
    });

    it("leaves the content type to the browser, which writes the boundary of the form", () => {
      const { xhr } = start();

      expect(Object.keys(xhr.headers).map((name) => name.toLowerCase())).not.toContain("content-type");
    });

    it("sends the token of the signed in person", () => {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, "abc.def.ghi");

      const { xhr } = start();

      expect(xhr.headers.Authorization).toBe("Bearer abc.def.ghi");
    });

    it("sends no Authorization header when nobody has a token", () => {
      const { xhr } = start();

      expect(xhr.headers).not.toHaveProperty("Authorization");
    });

    it("works when the browser does not let the page read its storage", () => {
      const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("blocked");
      });

      const { xhr } = start();

      expect(xhr.sent).toBe(true);
      expect(xhr.headers).not.toHaveProperty("Authorization");
      getItem.mockRestore();
    });
  });

  describe("the progress", () => {
    it("reports how much of the form has gone up, as a number from 0 to 1", () => {
      const seen: number[] = [];
      const { xhr } = start({ onProgress: (fraction) => seen.push(fraction) });

      xhr.progress(0, 400);
      xhr.progress(100, 400);
      xhr.progress(300, 400);

      expect(seen).toEqual([0, 0.25, 0.75]);
    });

    it("reaches 1 when everything was sent, also when the browser could not tell the total", () => {
      const seen: number[] = [];
      const { xhr } = start({ onProgress: (fraction) => seen.push(fraction) });

      xhr.upload.onprogress?.({ lengthComputable: false, loaded: 10, total: 0 });
      xhr.upload.onload?.();

      expect(seen).toEqual([1]);
    });

    it("ignores an event with a total of zero", () => {
      const seen: number[] = [];
      const { xhr } = start({ onProgress: (fraction) => seen.push(fraction) });

      xhr.progress(0, 0);

      expect(seen).toEqual([]);
    });

    it("works without anybody listening", async () => {
      const { promise, xhr } = start();

      xhr.progress(50, 100);
      xhr.answer(201, { request: { id: "1" } });

      await expect(promise).resolves.toEqual({ request: { id: "1" } });
    });
  });

  describe("the answer", () => {
    it.each([200, 201])("is the JSON of a %i answer", async (status) => {
      const { promise, xhr } = start();

      xhr.answer(status, { request: { id: "66a1b2c3d4e5f60718293a4b" } });

      await expect(promise).resolves.toEqual({ request: { id: "66a1b2c3d4e5f60718293a4b" } });
    });

    it.each([
      [400, "VALIDATION_ERROR", "Please enter how many units you need, as a whole number."],
      [401, "UNAUTHENTICATED", "Please sign in to do that."],
      [403, "FORBIDDEN", "You don't have access to that."],
      [413, "FILE_TOO_LARGE", "That file is too big. Each file can be up to 50 MB."],
      [429, "RATE_LIMITED", "You have sent a lot of quote requests. Please try again in an hour."],
      [500, "INTERNAL_ERROR", "Something went wrong on our side."],
    ])("is an ApiError with the status, the code and the message of the server for a %i", async (status, code, message) => {
      const { promise, xhr } = start();

      xhr.answer(status, standardError(code, message));

      const error = await failure(promise);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(status);
      expect(error.code).toBe(code);
      expect(error.message).toBe(message);
    });

    it.each([
      ["a page that is not JSON", "<html>Bad gateway</html>"],
      ["JSON without an error", { oops: true }],
      ["an error that is only text", { error: "nope" }],
      ["an error without a message", { error: { code: "X" } }],
      ["null", null],
    ])("is an ApiError that only knows the status when a 502 comes with %s", async (_label, body) => {
      const { promise, xhr } = start();

      xhr.answer(502, body);

      const error = await failure(promise);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(502);
      expect(error.message).toBe("The server answered 502.");
      expect(error.code).toBeUndefined();
    });

    it("is an ApiError when a 201 does not come with JSON", async () => {
      const { promise, xhr } = start();

      xhr.answer(201, "<html></html>");

      const error = await failure(promise);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(201);
      expect(error.message).toBe("The answer was not valid JSON.");
    });

    it("is an ApiError with status 0 when the server cannot be reached", async () => {
      const { promise, xhr } = start();

      xhr.failNetwork();

      const error = await failure(promise);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(0);
      expect(error.message).toBe("The server could not be reached.");
    });
  });

  describe("the success status that the caller asked for", () => {
    // a host that answers every address with its own page (a single page site without a backend behind it) answers 200
    // to a request that nobody handled, and that must not be taken for the answer of the server
    it("accepts that status", async () => {
      const { promise, xhr } = start({ successStatus: 201 });

      xhr.answer(201, { request: { id: "1" } });

      await expect(promise).resolves.toEqual({ request: { id: "1" } });
    });

    it.each([
      ["a 200 with a page of its own", 200, "<html>home page</html>"],
      ["a 200 with JSON", 200, { status: "ok" }],
      ["a 202", 202, { request: { id: "1" } }],
      ["a 204", 204, ""],
    ])("refuses %s, with the status it came with, because it is not the answer to this request", async (_label, status, body) => {
      const { promise, xhr } = start({ successStatus: 201 });

      xhr.answer(status, body);

      const error = await failure(promise);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(status);
      expect(error.message).toBe(`The server answered ${status}, which is not the answer to this request.`);
    });

    it("still gives a 201 that cannot be read as an ApiError with status 201, so the caller can tell it was created", async () => {
      const { promise, xhr } = start({ successStatus: 201 });

      xhr.answer(201, "<html></html>");

      const error = await failure(promise);
      expect([error.status, error.message]).toEqual([201, "The answer was not valid JSON."]);
    });

    it("still reads an error answer in the usual way", async () => {
      const { promise, xhr } = start({ successStatus: 201 });

      xhr.answer(429, standardError("RATE_LIMITED", "Please try again in an hour."));

      const error = await failure(promise);
      expect([error.status, error.code]).toEqual([429, "RATE_LIMITED"]);
    });

    it("takes any 2xx when nothing was asked for", async () => {
      const { promise, xhr } = start();

      xhr.answer(200, { fine: true });

      await expect(promise).resolves.toEqual({ fine: true });
    });
  });

  describe("cancelling", () => {
    it("stops the request when the signal is aborted, and says it was cancelled", async () => {
      const controller = new AbortController();
      const { promise, xhr } = start({ signal: controller.signal });

      controller.abort();

      expect(xhr.aborted).toBe(true);
      const error = await failure(promise);
      expect(error.status).toBe(0);
      expect(error.message).toBe("The request was cancelled.");
    });

    it("does not even start when the signal was aborted before", async () => {
      FakeXhr.autoAnswer = null;
      const controller = new AbortController();
      controller.abort();

      const error = await failure(api.upload("/b2b/quote", new FormData(), { lang: "en", signal: controller.signal }));

      expect(error.message).toBe("The request was cancelled.");
      expect(FakeXhr.requests).toHaveLength(0);
    });

    it("lets go of the signal once the request is over", async () => {
      const controller = new AbortController();
      const { promise, xhr } = start({ signal: controller.signal });
      xhr.answer(201, { request: { id: "1" } });
      await promise;

      controller.abort();

      expect(xhr.aborted).toBe(false);
    });
  });
});

// ---------- the calls that use fetch ----------

function stubFetch(answer: () => Response | Promise<Response>) {
  const fetchMock = vi.fn<typeof fetch>(async () => answer());
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const headersOf = (fetchMock: ReturnType<typeof stubFetch>) => (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;

describe("api.get", () => {
  it("reads JSON from the address under /api, with the language and the token", async () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, "abc.def.ghi");
    const fetchMock = stubFetch(() => new Response(JSON.stringify({ items: [] }), { status: 200 }));

    const answer = await api.get("/b2b/requests", { lang: "es", query: { limit: 100 } });

    expect(answer).toEqual({ items: [] });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/b2b/requests?limit=100");
    expect(headersOf(fetchMock)).toEqual({ Accept: "application/json", "Accept-Language": "es", Authorization: "Bearer abc.def.ghi" });
  });

  it("sends no Authorization header when nobody has a token", async () => {
    const fetchMock = stubFetch(() => new Response("{}", { status: 200 }));

    await api.get("/b2b/requests", { lang: "en" });

    expect(headersOf(fetchMock)).not.toHaveProperty("Authorization");
  });

  it("is an ApiError with the status, the code and the message of the server", async () => {
    stubFetch(() => new Response(JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "Please sign in to do that.", details: [] } }), { status: 401 }));

    const error = await failure(api.get("/b2b/requests", { lang: "en" }));

    expect(error).toBeInstanceOf(ApiError);
    expect([error.status, error.code, error.message]).toEqual([401, "UNAUTHENTICATED", "Please sign in to do that."]);
  });
});

describe("api.download", () => {
  it("fetches the file with the token in the Authorization header and gives it back as a Blob", async () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, "abc.def.ghi");
    const fetchMock = stubFetch(() => new Response("%PDF-1.4", { status: 200, headers: { "Content-Type": "application/pdf" } }));

    const file = await api.download("/b2b/requests/66a1/assets/one.pdf", { lang: "en" });

    expect(fetchMock.mock.calls[0][0]).toBe("/api/b2b/requests/66a1/assets/one.pdf");
    expect(headersOf(fetchMock).Authorization).toBe("Bearer abc.def.ghi");
    expect(file).toBeInstanceOf(Blob);
    expect(await file.text()).toBe("%PDF-1.4");
  });

  it.each([
    [401, "UNAUTHENTICATED", "Please sign in to do that."],
    [404, "FILE_NOT_FOUND", "That file doesn't exist."],
  ])("is an ApiError with the message of the server for a %i answer", async (status, code, message) => {
    stubFetch(() => new Response(JSON.stringify({ error: { code, message, details: [] } }), { status }));

    const error = await failure(api.download("/b2b/requests/66a1/assets/one.pdf", { lang: "en" }));

    expect([error.status, error.code, error.message]).toEqual([status, code, message]);
  });

  it("is an ApiError that only knows the status when the answer is not in the usual shape", async () => {
    stubFetch(() => new Response("<html>Bad gateway</html>", { status: 502 }));

    const error = await failure(api.download("/b2b/requests/66a1/assets/one.pdf", { lang: "en" }));

    expect([error.status, error.message, error.code]).toEqual([502, "The server answered 502.", undefined]);
  });

  it("is an ApiError with status 0 when the server cannot be reached", async () => {
    stubFetch(() => Promise.reject(new TypeError("Failed to fetch")));

    const error = await failure(api.download("/b2b/requests/66a1/assets/one.pdf", { lang: "en" }));

    expect([error.status, error.message]).toEqual([0, "The server could not be reached."]);
  });

  it("says it was cancelled when the signal is aborted, and does not even ask when it was aborted before", async () => {
    const controller = new AbortController();
    const fetchMock = stubFetch(
      () =>
        new Promise<Response>((_resolve, reject) => {
          controller.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );

    const running = failure(api.download("/b2b/requests/66a1/assets/one.pdf", { lang: "en", signal: controller.signal }));
    controller.abort();
    expect((await running).message).toBe("The request was cancelled.");

    fetchMock.mockClear();
    expect((await failure(api.download("/x", { lang: "en", signal: controller.signal }))).message).toBe("The request was cancelled.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
