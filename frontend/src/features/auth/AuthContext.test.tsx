import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { LanguageProvider } from "../../i18n/LanguageContext";
import { getAuthToken } from "../../lib/authToken";
import { announceSession, readSession } from "../../lib/session";
import { businessAccount, installFakeServer, retailAccount } from "../../test/fakeServer";
import { AuthProvider, InitialAuthContext, toAuthUser, useAuth, type InitialAuth } from "./AuthContext";

function makeWrapper(options: { path?: string; initial?: InitialAuth } = {}) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[options.path ?? "/en"]}>
        <LanguageProvider>
          <AuthProvider initial={options.initial}>{children}</AuthProvider>
        </LanguageProvider>
      </MemoryRouter>
    );
  };
}

describe("AuthProvider when the page loads", () => {
  it("starts as loading, and is a guest when the server knows nobody", async () => {
    installFakeServer();

    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    expect(result.current).toMatchObject({ status: "loading", user: null });

    await waitFor(() => expect(result.current.status).toBe("guest"));
    expect(result.current.user).toBeNull();
    expect(getAuthToken()).toBeNull();
  });

  it("restores a sign in with the refresh cookie: the user is there and the token is kept in memory", async () => {
    installFakeServer().withCookieOf(retailAccount);

    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.status).toBe("authed"));
    expect(result.current.user).toMatchObject({ id: retailAccount.id, email: "isabel@example.com", name: "Isabel Vasquez", accountType: "retail", role: "user", preferredLanguage: "en" });
    expect(getAuthToken()).toMatch(/^token-/);
    // a reload is not a sign in
    expect(result.current.signInCount).toBe(0);
  });

  it("does not keep anything about the sign in in a storage of the browser", async () => {
    installFakeServer().withCookieOf(retailAccount);
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.status).toBe("authed"));

    expect(setItem).not.toHaveBeenCalledWith(expect.stringMatching(/user|token|auth|session/i), expect.anything());
    expect(JSON.stringify({ ...sessionStorage, ...localStorage })).not.toContain("isabel@example.com");
    setItem.mockRestore();
  });

  it("calls a business account a business account, with the company and the verification from its business details", async () => {
    const server = installFakeServer().withCookieOf(businessAccount);

    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.status).toBe("authed"));
    expect(result.current.user).toMatchObject({ accountType: "business", companyName: "Hacienda Brands", verificationStatus: "pending" });
    expect(server.callsTo("GET", "/api/users/me")).toHaveLength(1);
  });

  it("does not ask for business details of a retail account", async () => {
    const server = installFakeServer().withCookieOf(retailAccount);

    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.status).toBe("authed"));

    expect(server.callsTo("GET", "/api/users/me")).toHaveLength(0);
  });

  it("is still signed in, without a company, when the business details cannot be read", async () => {
    const server = installFakeServer().withCookieOf(businessAccount);
    server.override = (call) => (call.path === "/api/users/me" ? new Response("{}", { status: 500 }) : undefined);

    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.status).toBe("authed"));
    expect(result.current.user).toMatchObject({ accountType: "business" });
    expect(result.current.user?.companyName).toBeUndefined();
  });

  it("is a guest, not stuck on loading, when the server cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));

    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.status).toBe("guest"));
  });

  it("does not ask the server when the app was started with somebody signed in, or with nobody", async () => {
    const server = installFakeServer();
    const signed = renderHook(() => useAuth(), { wrapper: makeWrapper({ initial: { status: "authed", user: toAuthUser(readSession({ user: { id: "1", email: "a@b.co", name: "A", role: "user", accountType: "retail" }, accessToken: "x" })!.user) } }) });
    const nobody = renderHook(() => useAuth(), { wrapper: makeWrapper({ initial: { status: "guest" } }) });

    expect(signed.result.current).toMatchObject({ status: "authed", user: { email: "a@b.co" } });
    expect(nobody.result.current).toMatchObject({ status: "guest", user: null });
    expect(server.calls).toHaveLength(0);
  });

  it("takes the start from InitialAuthContext, which is how the tests of pages start", () => {
    installFakeServer();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <InitialAuthContext.Provider value={{ status: "guest" }}>{makeWrapper()({ children })}</InitialAuthContext.Provider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.status).toBe("guest");
  });
});

describe("signIn", () => {
  it("signs in, keeps the token in memory and the user, and counts the sign in", async () => {
    installFakeServer();
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper({ initial: { status: "guest" } }) });

    let user: Awaited<ReturnType<typeof result.current.signIn>> | undefined;
    await act(async () => {
      user = await result.current.signIn("isabel@example.com", "correct horse 42");
    });

    expect(user).toMatchObject({ email: "isabel@example.com" });
    expect(result.current).toMatchObject({ status: "authed", signInCount: 1 });
    expect(result.current.user?.id).toBe(retailAccount.id);
    expect(getAuthToken()).toMatch(/^token-/);
  });

  it("sends the email and the password to the sign in route, and nothing else", async () => {
    const server = installFakeServer();
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper({ initial: { status: "guest" } }) });

    await act(async () => {
      await result.current.signIn("isabel@example.com", "correct horse 42");
    });

    expect(server.callsTo("POST", "/api/auth/login")[0].body).toEqual({ email: "isabel@example.com", password: "correct horse 42" });
  });

  it("fails with the error of the server, and stays a guest", async () => {
    installFakeServer();
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper({ initial: { status: "guest" } }) });

    await expect(act(() => result.current.signIn("isabel@example.com", "not the password 1"))).rejects.toMatchObject({ status: 401, code: "INVALID_CREDENTIALS" });

    expect(result.current).toMatchObject({ status: "guest", user: null, signInCount: 0 });
    expect(getAuthToken()).toBeNull();
  });

  it("signs a business account in with its company", async () => {
    installFakeServer();
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper({ initial: { status: "guest" } }) });

    await act(async () => {
      await result.current.signIn("isabel@hacienda.example", "correct horse 42");
    });

    expect(result.current.user).toMatchObject({ accountType: "business", companyName: "Hacienda Brands" });
  });
});

describe("register", () => {
  it("makes a retail account and signs it in, with the language of the page as the language of the account", async () => {
    const server = installFakeServer();
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper({ path: "/es", initial: { status: "guest" } }) });

    await act(async () => {
      await result.current.register({ name: "Marco Rossi", email: "marco@example.com", password: "correct horse 42", accountType: "retail" });
    });

    expect(server.callsTo("POST", "/api/auth/register")[0].body).toEqual({ name: "Marco Rossi", email: "marco@example.com", password: "correct horse 42", accountType: "retail", preferredLanguage: "es" });
    expect(result.current).toMatchObject({ status: "authed", signInCount: 1, user: { email: "marco@example.com", accountType: "retail", preferredLanguage: "es" } });
  });

  it("makes a business account: it is sent as b2b, with its company, and the user is a business account", async () => {
    const server = installFakeServer();
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper({ initial: { status: "guest" } }) });

    await act(async () => {
      await result.current.register({ name: "Isabel Vasquez", email: "new@hacienda.example", password: "correct horse 42", accountType: "business", companyName: "Hacienda Brands" });
    });

    expect(server.callsTo("POST", "/api/auth/register")[0].body).toMatchObject({ accountType: "b2b", companyName: "Hacienda Brands" });
    expect(result.current.user).toMatchObject({ accountType: "business", companyName: "Hacienda Brands" });
  });

  it("does not send a company for a retail account", async () => {
    const server = installFakeServer();
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper({ initial: { status: "guest" } }) });

    await act(async () => {
      await result.current.register({ name: "Marco", email: "marco@example.com", password: "correct horse 42", accountType: "retail", companyName: "Left Over Inc" });
    });

    expect(server.callsTo("POST", "/api/auth/register")[0].body).not.toHaveProperty("companyName");
  });

  it("fails with EMAIL_TAKEN for an email that has an account, and stays a guest", async () => {
    installFakeServer();
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper({ initial: { status: "guest" } }) });

    await expect(act(() => result.current.register({ name: "Isabel", email: "isabel@example.com", password: "correct horse 42", accountType: "retail" }))).rejects.toMatchObject({ status: 409, code: "EMAIL_TAKEN" });

    expect(result.current.status).toBe("guest");
  });
});

describe("signOut", () => {
  it("ends the sign in on the server, takes the token away and forgets the user", async () => {
    const server = installFakeServer().withCookieOf(retailAccount);
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.status).toBe("authed"));

    await act(() => result.current.signOut());

    expect(server.callsTo("POST", "/api/auth/logout")).toHaveLength(1);
    expect(result.current).toMatchObject({ status: "guest", user: null });
    expect(getAuthToken()).toBeNull();
    expect(server.cookieOf).toBeNull();
  });

  it("signs the person out here even when the server cannot be reached", async () => {
    installFakeServer().withCookieOf(retailAccount);
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.status).toBe("authed"));
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));

    await act(() => result.current.signOut());

    expect(result.current).toMatchObject({ status: "guest", user: null });
    expect(getAuthToken()).toBeNull();
  });
});

describe("what happens to the session without the page asking", () => {
  it("makes the person a guest when the sign in ended", async () => {
    installFakeServer().withCookieOf(retailAccount);
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.status).toBe("authed"));

    act(() => announceSession(null));

    expect(result.current).toMatchObject({ status: "guest", user: null });
  });

  it("updates the user when the token of the same person was renewed, and keeps the business details", async () => {
    installFakeServer().withCookieOf(businessAccount);
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.status).toBe("authed"));

    act(() => announceSession(readSession({ user: { id: businessAccount.id, email: businessAccount.email, name: "Isabel V.", role: "user", accountType: "b2b", preferredLanguage: "es", marketingEmails: true }, accessToken: "new" })));

    expect(result.current.user).toMatchObject({ name: "Isabel V.", preferredLanguage: "es", marketingEmails: true, companyName: "Hacienda Brands", accountType: "business" });
  });

  it("ignores a renewed token of somebody else", async () => {
    installFakeServer().withCookieOf(retailAccount);
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.status).toBe("authed"));

    act(() => announceSession(readSession({ user: { id: "someone-else", email: "x@y.co", name: "X", role: "user", accountType: "retail" }, accessToken: "new" })));

    expect(result.current.user?.id).toBe(retailAccount.id);
  });
});

describe("updateUser", () => {
  it("changes what is known about the signed in person, and does nothing when nobody is signed in", async () => {
    installFakeServer().withCookieOf(retailAccount);
    const signedIn = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => expect(signedIn.result.current.status).toBe("authed"));
    const guest = renderHook(() => useAuth(), { wrapper: makeWrapper({ initial: { status: "guest" } }) });

    act(() => signedIn.result.current.updateUser({ name: "Isabel V.", phone: "+1 555 010 2030" }));
    act(() => guest.result.current.updateUser({ name: "Nobody" }));

    expect(signedIn.result.current.user).toMatchObject({ name: "Isabel V.", phone: "+1 555 010 2030", email: "isabel@example.com" });
    expect(guest.result.current.user).toBeNull();
  });
});

describe("toAuthUser", () => {
  it("turns the b2b account type into business, and keeps the rest", () => {
    const server = readSession({ user: { id: "1", email: "a@b.co", name: "A", role: "admin", accountType: "b2b", phone: "+1 555 010 2030", preferredLanguage: "es", marketingEmails: true, createdAt: "2026-02-03T00:00:00.000Z" }, accessToken: "x" })!.user;

    expect(toAuthUser(server, { companyName: "Hacienda" })).toEqual({
      id: "1",
      email: "a@b.co",
      name: "A",
      role: "admin",
      accountType: "business",
      phone: "+1 555 010 2030",
      preferredLanguage: "es",
      marketingEmails: true,
      createdAt: "2026-02-03T00:00:00.000Z",
      companyName: "Hacienda",
    });
  });
});

describe("useAuth", () => {
  it("must be used inside AuthProvider", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useAuth())).toThrow("useAuth must be used inside AuthProvider");

    error.mockRestore();
  });
});
