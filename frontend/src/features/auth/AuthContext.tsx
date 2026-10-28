// Who is signed in. There is no account system yet, so this is a small stand-in for it: signing in on the preview
// forms keeps the email and the account type until the browser tab is closed. It only decides what the pages
// show. Anything that really needs protecting is checked again by the server, so the real sign in can replace
// this file and keep the same useAuth().
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { AccountType } from "./components/AuthShell";

export interface AuthUser {
  email: string;
  accountType: AccountType;
  // only known after an account was created in this tab, the pages that use them (the studio form) work without them
  name?: string;
  companyName?: string;
}

interface AuthValue {
  // null when nobody is signed in
  user: AuthUser | null;
  signIn: (user: AuthUser) => void;
  signOut: () => void;
}

export const AUTH_STORAGE_KEY = "sc_user";

const AuthContext = createContext<AuthValue | null>(null);

function savedUser(): AuthUser | null {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(AUTH_STORAGE_KEY) ?? "null");
    if (typeof saved !== "object" || saved === null) return null;
    const { email, accountType, name, companyName } = saved as Record<string, unknown>;
    if (typeof email === "string" && (accountType === "retail" || accountType === "business")) {
      return {
        email,
        accountType,
        ...(typeof name === "string" && name ? { name } : {}),
        ...(typeof companyName === "string" && companyName ? { companyName } : {}),
      };
    }
  } catch {
    // a missing or broken saved value just means nobody is signed in
  }
  return null;
}

function remember(user: AuthUser | null) {
  try {
    if (user) sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // saving is a convenience only, the page works without it
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(savedUser);

  const signIn = useCallback((next: AuthUser) => {
    remember(next);
    setUser(next);
  }, []);

  const signOut = useCallback(() => {
    remember(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthValue>(() => ({ user, signIn, signOut }), [user, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
