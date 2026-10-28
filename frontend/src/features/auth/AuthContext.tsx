import React, { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { AccountType } from "./components/AuthShell";

export interface AuthUser {
  id?: string;
  fullName?: string;
  email: string;
  accountType: AccountType;
  phone?: string;
  companyName?: string;
}

export type AuthStatus = "loading" | "guest" | "authenticated";

interface AuthValue {
  user: AuthUser | null;
  status: AuthStatus;
  signIn: (user: AuthUser) => void;
  signOut: () => void;
  login: (email: string, password: string) => Promise<boolean>;
  register: (data: Partial<AuthUser> & { password: string }) => Promise<boolean>;
  logout: () => void;
}

export const AUTH_STORAGE_KEY = "sc_user";

const AuthContext = createContext<AuthValue | null>(null);

function savedUser(): AuthUser | null {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(AUTH_STORAGE_KEY) ?? "null");
    if (typeof saved !== "object" || saved === null) return null;
    const { email, accountType, fullName, id, companyName, phone } = saved as Record<string, unknown>;
    if (typeof email === "string" && (accountType === "retail" || accountType === "business")) {
      return {
        email,
        accountType,
        fullName: typeof fullName === "string" ? fullName : email.split("@")[0],
        id: typeof id === "string" ? id : "usr_demo",
        companyName: typeof companyName === "string" ? companyName : undefined,
        phone: typeof phone === "string" ? phone : undefined
      };
    }
  } catch {
    // missing or broken stored session
  }
  return null;
}

function remember(user: AuthUser | null) {
  try {
    if (user) {
      sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      localStorage.setItem("solcacao_user", JSON.stringify(user));
      localStorage.setItem("solcacao_token", "demo_jwt_token");
    } else {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem("solcacao_user");
      localStorage.removeItem("solcacao_token");
    }
  } catch {
    // storage fallback
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

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    if (!email || !password) return false;
    const isBusiness = email.toLowerCase().includes("business") || email.toLowerCase().includes("corp");
    const nextUser: AuthUser = {
      id: "usr_mock_1",
      fullName: email.split("@")[0],
      email,
      accountType: isBusiness ? "business" : "retail",
      companyName: isBusiness ? "Enterprise Partner" : undefined
    };
    signIn(nextUser);
    return true;
  }, [signIn]);

  const register = useCallback(async (data: Partial<AuthUser> & { password: string }): Promise<boolean> => {
    if (!data.email || !data.password) return false;
    const nextUser: AuthUser = {
      id: `usr_${Date.now()}`,
      fullName: data.fullName ?? data.email.split("@")[0],
      email: data.email,
      accountType: data.accountType ?? "retail",
      companyName: data.companyName,
      phone: data.phone
    };
    signIn(nextUser);
    return true;
  }, [signIn]);

  const status: AuthStatus = user ? "authenticated" : "guest";

  const value = useMemo<AuthValue>(
    () => ({
      user,
      status,
      signIn,
      signOut,
      login,
      register,
      logout: signOut
    }),
    [user, status, signIn, signOut, login, register]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}