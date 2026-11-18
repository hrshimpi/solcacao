// Who is signed in. The server knows: a sign in gives the page a short lived token (kept in memory, see lib/authToken.ts)
// and a cookie that the page cannot read. When the page loads it asks the server for a new token with that cookie, so a
// reload keeps a person signed in without anything being saved in the browser. Until the answer is there the status is
// "loading", and the pages that depend on who is signed in wait instead of sending a signed in person to the sign in page.
// The pages only decide what to show. Everything that needs protecting is checked again by the server.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Lang } from "../../i18n";
import { useLang } from "../../i18n/LanguageContext";
import { api } from "../../lib/api";
import { apiFetch } from "../../lib/apiFetch";
import { setAuthToken } from "../../lib/authToken";
import { onSessionChange, readSession, refreshSession, type ServerUser } from "../../lib/session";
import type { AccountType } from "./components/AuthShell";

export type VerificationStatus = "pending" | "verified" | "rejected";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  accountType: AccountType;
  phone?: string;
  preferredLanguage: Lang;
  // whether the person wants emails about new releases
  marketingEmails: boolean;
  createdAt: string;
  // for a business account, from its business details
  companyName?: string;
  verificationStatus?: VerificationStatus;
}

export type AuthStatus = "loading" | "guest" | "authed";

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  accountType: AccountType;
  companyName?: string;
}

interface AuthValue {
  status: AuthStatus;
  // null when nobody is signed in (or the answer is not there yet)
  user: AuthUser | null;
  // These fail with an ApiError that says why (a wrong password, an email that has an account...)
  signIn: (email: string, password: string) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  // changes what is known about the signed in person after the server accepted a change
  updateUser: (patch: Partial<AuthUser>) => void;
  // goes up by one every time somebody signs in or signs up (not when a session is restored), for the things that
  // follow a sign in, like adding the cart of a visitor to the cart of the user
  signInCount: number;
}

// what the page starts with when it already knows (the tests, which never ask a server)
export type InitialAuth = { status: "guest" } | { status: "authed"; user: AuthUser };

// A way to start the app with somebody signed in, or known to be nobody, without asking the server. Nothing in the app
// provides it, so a real page always asks. The tests provide it around the router (see test/renderAt.tsx).
export const InitialAuthContext = createContext<InitialAuth | undefined>(undefined);

const AuthContext = createContext<AuthValue | null>(null);

// the server calls a business account "b2b"
export function toAuthUser(server: ServerUser, extra: Pick<AuthUser, "companyName" | "verificationStatus"> = {}): AuthUser {
  return {
    id: server.id,
    email: server.email,
    name: server.name,
    role: server.role,
    accountType: server.accountType === "b2b" ? "business" : "retail",
    ...(server.phone ? { phone: server.phone } : {}),
    preferredLanguage: server.preferredLanguage,
    marketingEmails: server.marketingEmails,
    createdAt: server.createdAt,
    ...extra,
  };
}

interface Account {
  user: ServerUser;
  b2bProfile: { companyName?: string; verificationStatus?: VerificationStatus } | null;
}

export function AuthProvider({ children, initial: given }: { children: ReactNode; initial?: InitialAuth }) {
  const { lang } = useLang();
  const injected = useContext(InitialAuthContext);
  const initial = given ?? injected;
  const [state, setState] = useState<{ status: AuthStatus; user: AuthUser | null }>(
    initial ? (initial.status === "authed" ? { status: "authed", user: initial.user } : { status: "guest", user: null }) : { status: "loading", user: null },
  );
  const [signInCount, setSignInCount] = useState(0);
  // the language of the moment, for calls that are made from effects that must not start again when it changes
  const langRef = useRef(lang);
  langRef.current = lang;

  // the user with the business details a business account has
  const withBusiness = useCallback(async (server: ServerUser): Promise<AuthUser> => {
    if (server.accountType !== "b2b") return toAuthUser(server);
    try {
      const account = await api.get<Account>("/users/me", { lang: langRef.current });
      return toAuthUser(server, { companyName: account.b2bProfile?.companyName, verificationStatus: account.b2bProfile?.verificationStatus });
    } catch {
      // the business details are a convenience for the pages, the account works without them
      return toAuthUser(server);
    }
  }, []);

  // restores the sign in of a person who comes back to the page (a reload, a new tab)
  useEffect(() => {
    if (initial) return;
    let cancelled = false;

    refreshSession()
      .then(async (answer) => {
        if (cancelled) return;
        if (!answer) {
          setState({ status: "guest", user: null });
          return;
        }
        const user = await withBusiness(answer.user);
        if (!cancelled) setState({ status: "authed", user });
      })
      // the server could not be reached: nobody can be shown as signed in, and nothing was changed
      .catch(() => {
        if (!cancelled) setState({ status: "guest", user: null });
      });

    return () => {
      cancelled = true;
    };
  }, [initial, withBusiness]);

  // the sign in ended on its own (the cookie is gone or was used by a thief), or the token was renewed
  useEffect(
    () =>
      onSessionChange((answer) => {
        if (!answer) {
          setState({ status: "guest", user: null });
          return;
        }
        // the same person with a new token: what the server says about them replaces what we had, and the business details stay
        setState((current) => {
          const known = current.user;
          if (known?.id !== answer.user.id) return current;
          return { status: "authed", user: toAuthUser(answer.user, { companyName: known.companyName, verificationStatus: known.verificationStatus }) };
        });
      }),
    [],
  );

  const startSession = useCallback(
    async (body: unknown): Promise<AuthUser> => {
      const answer = readSession(body);
      if (!answer) throw new Error("The server's answer is not a sign in.");

      setAuthToken(answer.accessToken);
      const user = await withBusiness(answer.user);
      setState({ status: "authed", user });
      setSignInCount((count) => count + 1);
      return user;
    },
    [withBusiness],
  );

  const signIn = useCallback(
    async (email: string, password: string) => startSession(await apiFetch("/auth/login", { lang: langRef.current, method: "POST", json: { email, password } })),
    [startSession],
  );

  const register = useCallback(
    async (input: RegisterInput) =>
      startSession(
        await apiFetch("/auth/register", {
          lang: langRef.current,
          method: "POST",
          json: {
            name: input.name,
            email: input.email,
            password: input.password,
            accountType: input.accountType === "business" ? "b2b" : "retail",
            ...(input.accountType === "business" ? { companyName: input.companyName } : {}),
            preferredLanguage: langRef.current,
          },
        }),
      ),
    [startSession],
  );

  const signOut = useCallback(async () => {
    try {
      await apiFetch("/auth/logout", { lang: langRef.current, method: "POST" });
    } catch {
      // the person is signed out here either way, and the cookie runs out by itself
    }
    setAuthToken(null);
    setState({ status: "guest", user: null });
  }, []);

  const updateUser = useCallback((patch: Partial<AuthUser>) => {
    setState((current) => (current.user ? { ...current, user: { ...current.user, ...patch } } : current));
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ status: state.status, user: state.user, signIn, register, signOut, updateUser, signInCount }),
    [state, signIn, register, signOut, updateUser, signInCount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
