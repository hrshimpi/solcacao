import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuthToken, setAuthToken } from "./authToken";
import { onSessionChange, readSession, refreshSession, type SessionAnswer } from "./session";

const serverUser = { id: "64b7f0c2a1b2c3d4e5f60718", email: "isabel@example.com", name: "Isabel Vasquez", role: "user", accountType: "retail", preferredLanguage: "es", marketingEmails: true, phone: "+1 555 010 2030", createdAt: "2026-01-01T00:00:00.000Z" };
const goodBody = { user: serverUser, accessToken: "abc.def.ghi", expiresIn: 900 };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const noSession = () => json({ error: { code: "SESSION_EXPIRED", message: "Your session ended.", details: [] } }, 401);

afterEach(() => {
  vi.useRealTimers();
});

describe("readSession", () => {
  it("reads a good answer of the server", () => {
    expect(readSession(goodBody)).toEqual({ user: serverUser, accessToken: "abc.def.ghi", expiresIn: 900 });
  });

  it("makes the language English unless it is Spanish, and a choice about emails that is not true false", () => {
    const odd = readSession({ ...goodBody, user: { ...serverUser, preferredLanguage: "fr", marketingEmails: "yes", phone: "" } });

    expect(odd?.user).toMatchObject({ preferredLanguage: "en", marketingEmails: false });
    expect(odd?.user).not.toHaveProperty("phone");
  });

  it.each([
    ["nothing", undefined],
    ["text", "ok"],
    ["no user", { accessToken: "abc" }],
    ["no token", { user: serverUser }],
    ["an empty token", { user: serverUser, accessToken: "" }],
    ["a user without an id", { user: { ...serverUser, id: undefined }, accessToken: "abc" }],
    ["a role that does not exist", { user: { ...serverUser, role: "owner" }, accessToken: "abc" }],
    ["an account type that does not exist", { user: { ...serverUser, accountType: "business" }, accessToken: "abc" }],
  ])("is not a session when it has %s", (_what, body) => {
    expect(readSession(body)).toBeNull();
  });
});

describe("refreshSession", () => {
  it("asks the server with a POST, keeps the new token and gives the user", async () => {
    const fetchMock = vi.fn(async () => json(goodBody));
    vi.stubGlobal("fetch", fetchMock);

    const answer = await refreshSession();

    expect(answer?.user.email).toBe("isabel@example.com");
    expect(getAuthToken()).toBe("abc.def.ghi");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/auth/refresh");
    expect(init.method).toBe("POST");
  });

  it("does not put the token anywhere in the browser", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(goodBody)));
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    await refreshSession();

    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it("tells whoever listens, with the answer", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(goodBody)));
    const heard: (SessionAnswer | null)[] = [];
    const stop = onSessionChange((answer) => heard.push(answer));

    await refreshSession();
    stop();

    expect(heard).toHaveLength(1);
    expect(heard[0]?.user.id).toBe(serverUser.id);
  });

  it("stops telling a listener that was removed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(goodBody)));
    const heard: unknown[] = [];
    const stop = onSessionChange((answer) => heard.push(answer));
    stop();

    await refreshSession();

    expect(heard).toEqual([]);
  });

  it("gives null and takes the token away when nobody is signed in, and tells the listeners", async () => {
    setAuthToken("old.token.value");
    vi.stubGlobal("fetch", vi.fn(async () => noSession()));
    const heard: unknown[] = [];
    const stop = onSessionChange((answer) => heard.push(answer));

    expect(await refreshSession()).toBeNull();
    stop();

    expect(getAuthToken()).toBeNull();
    expect(heard).toEqual([null]);
  });

  it("asks once for a person who is not signed in, because every visit would wait for a second try otherwise", async () => {
    const fetchMock = vi.fn(async () => noSession());
    vi.stubGlobal("fetch", fetchMock);

    await refreshSession();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("asks again a moment later when it was told to, and takes the second answer", async () => {
    vi.useFakeTimers();
    const answers = [noSession(), json(goodBody)];
    const fetchMock = vi.fn(async () => answers.shift()!);
    vi.stubGlobal("fetch", fetchMock);

    const pending = refreshSession({ retryOnce: true });
    await vi.advanceTimersByTimeAsync(1000);

    expect((await pending)?.user.id).toBe(serverUser.id);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getAuthToken()).toBe("abc.def.ghi");
  });

  it("shares one request between calls made at the same moment, and asks again for the next one", async () => {
    const fetchMock = vi.fn(async () => json(goodBody));
    vi.stubGlobal("fetch", fetchMock);

    const [first, second, third] = await Promise.all([refreshSession(), refreshSession(), refreshSession()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
    expect(second).toBe(third);

    await refreshSession();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails with an ApiError when the server cannot be reached, and keeps the token it had", async () => {
    setAuthToken("old.token.value");
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));

    await expect(refreshSession()).rejects.toMatchObject({ name: "ApiError", status: 0 });

    expect(getAuthToken()).toBe("old.token.value");
  });

  it.each([
    ["a server error", () => json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong." } }, 500)],
    ["a page instead of JSON", () => new Response("<html></html>", { status: 200 })],
    ["an answer in a shape we do not know", () => json({ ok: true })],
  ])("fails with an ApiError for %s, and does not sign anybody out", async (_what, answer) => {
    setAuthToken("old.token.value");
    vi.stubGlobal("fetch", vi.fn(async () => answer()));
    const heard: unknown[] = [];
    const stop = onSessionChange((value) => heard.push(value));

    await expect(refreshSession()).rejects.toMatchObject({ name: "ApiError" });
    stop();

    expect(getAuthToken()).toBe("old.token.value");
    expect(heard).toEqual([]);
  });

  it("can be asked again after it failed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    await expect(refreshSession()).rejects.toBeDefined();

    vi.stubGlobal("fetch", vi.fn(async () => json(goodBody)));

    expect((await refreshSession())?.accessToken).toBe("abc.def.ghi");
  });
});
