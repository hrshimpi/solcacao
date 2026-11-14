// The sign in of the person who is using the page, as the server keeps it. A sign in is two things: a short lived token
// that the page keeps in memory (see authToken.ts), and a cookie that scripts cannot read, which the page uses to get a
// new token. refreshSession asks for a new token with the cookie. It is how a reload keeps a person signed in, and how a
// token that ran out is replaced.
import type { Lang } from "../i18n";
import { ApiError, errorFrom } from "./apiError";
import { setAuthToken } from "./authToken";

// a user as the server sends them
export interface ServerUser {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  // the server calls a business account "b2b"
  accountType: "retail" | "b2b";
  phone?: string;
  preferredLanguage: Lang;
  marketingEmails: boolean;
  createdAt: string;
}

export interface SessionAnswer {
  user: ServerUser;
  accessToken: string;
  // seconds until the token runs out
  expiresIn: number;
}

type Listener = (answer: SessionAnswer | null) => void;

const listeners = new Set<Listener>();

// The screens that show who is signed in are told when the session changes without them asking: a token that was
// renewed, or a sign in that has ended. null means that nobody is signed in any more.
export function onSessionChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function announceSession(answer: SessionAnswer | null): void {
  for (const listener of listeners) listener(answer);
}

// a user as the server sends them, or null when it is not in that shape
export function readServerUser(value: unknown): ServerUser | null {
  if (typeof value !== "object" || value === null) return null;
  const { id, email, name, role, accountType, phone, preferredLanguage, marketingEmails, createdAt } = value as Record<string, unknown>;
  if (typeof id !== "string" || typeof email !== "string" || typeof name !== "string") return null;
  if (role !== "user" && role !== "admin") return null;
  if (accountType !== "retail" && accountType !== "b2b") return null;

  return {
    id,
    email,
    name,
    role,
    accountType,
    ...(typeof phone === "string" && phone ? { phone } : {}),
    preferredLanguage: preferredLanguage === "es" ? "es" : "en",
    marketingEmails: marketingEmails === true,
    createdAt: typeof createdAt === "string" ? createdAt : "",
  };
}

// what the server sends for a good sign in, or null when it is not in that shape
export function readSession(body: unknown): SessionAnswer | null {
  if (typeof body !== "object" || body === null) return null;
  const { user, accessToken, expiresIn } = body as Record<string, unknown>;
  const readUser = readServerUser(user);
  if (!readUser || typeof accessToken !== "string" || accessToken === "") return null;

  return { user: readUser, accessToken, expiresIn: typeof expiresIn === "number" ? expiresIn : 0 };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// asks the server once: the answer, null when there is no sign in (no cookie, or one that is no good), or an ApiError
async function ask(): Promise<SessionAnswer | null> {
  let response: Response;
  try {
    response = await fetch("/api/auth/refresh", { method: "POST", headers: { Accept: "application/json" } });
  } catch {
    throw new ApiError("The server could not be reached.");
  }

  if (response.status === 401) return null;
  if (!response.ok) throw errorFrom(response.status, await response.json().catch(() => undefined));

  const answer = readSession(await response.json().catch(() => undefined));
  if (!answer) throw new ApiError("The answer was not valid.", response.status);
  return answer;
}

let inFlight: Promise<SessionAnswer | null> | undefined;

// Gets a new token with the cookie, and keeps it. Calls made at the same moment share one request, because the cookie
// works once. With retryOnce, a "no" is asked a second time after a moment, because another tab may have swapped the
// cookie a second ago and the answer to that one is "try again".
export function refreshSession({ retryOnce = false }: { retryOnce?: boolean } = {}): Promise<SessionAnswer | null> {
  inFlight ??= (async () => {
    try {
      let answer = await ask();
      if (!answer && retryOnce) {
        await sleep(300);
        answer = await ask();
      }
      setAuthToken(answer?.accessToken ?? null);
      announceSession(answer);
      return answer;
    } finally {
      inFlight = undefined;
    }
  })();
  return inFlight;
}
