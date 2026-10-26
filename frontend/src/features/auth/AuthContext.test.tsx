import { act, render, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { AUTH_STORAGE_KEY, AuthProvider, useAuth } from "./AuthContext";

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe("useAuth", () => {
  it("starts with nobody signed in", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user).toBeNull();
  });

  it("keeps the user that signs in, and forgets them when they sign out", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => result.current.signIn({ email: "isabel@example.com", accountType: "business" }));
    expect(result.current.user).toEqual({ email: "isabel@example.com", accountType: "business" });

    act(() => result.current.signOut());
    expect(result.current.user).toBeNull();
    expect(sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it("is still signed in after the page is loaded again in the same tab", () => {
    const first = renderHook(() => useAuth(), { wrapper });
    act(() => first.result.current.signIn({ email: "isabel@example.com", accountType: "retail" }));
    first.unmount();

    const second = renderHook(() => useAuth(), { wrapper });

    expect(second.result.current.user).toEqual({ email: "isabel@example.com", accountType: "retail" });
  });

  it.each([
    ["text that is not JSON", "not json"],
    ["a user without an email", JSON.stringify({ accountType: "business" })],
    ["an account type that does not exist", JSON.stringify({ email: "a@b.co", accountType: "admin" })],
    ["a number", "42"],
    ["null", "null"],
  ])("treats %s as nobody signed in", (_name, saved) => {
    sessionStorage.setItem(AUTH_STORAGE_KEY, saved);

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user).toBeNull();
  });

  it("keeps only the email and the account type from what was saved", () => {
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ email: "a@b.co", accountType: "business", role: "admin" }));

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user).toEqual({ email: "a@b.co", accountType: "business" });
  });

  it("works when the browser does not let the page save anything", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => result.current.signIn({ email: "isabel@example.com", accountType: "business" }));

    expect(result.current.user?.accountType).toBe("business");
    setItem.mockRestore();
  });

  it("complains when it is used outside the provider", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<Probe />)).toThrow("useAuth must be used inside AuthProvider");
    error.mockRestore();
  });
});

function Probe() {
  useAuth();
  return null;
}
