// A small helper for calling our own API (everything under /api). It sends the current language in the
// Accept-Language header, gives up after a few seconds, and turns every kind of failure (no network, a bad
// status, an answer that is not JSON) into one ApiError, so screens only need one catch.
// A call that needs a signed in person (auth: true) sends the token, and when the server says the token ran out
// (401 TOKEN_EXPIRED) it gets a new one with the refresh cookie and tries once more, so a person is not signed out
// in the middle of what they were doing.
import type { Lang } from "../i18n";
import { ApiError, errorFrom } from "./apiError";
import { getAuthToken } from "./authToken";
import { refreshSession } from "./session";

export { ApiError, errorFrom, type ApiErrorDetail } from "./apiError";

// the headers every call sends. The token is only sent when the call asks for it, so public calls never carry it.
export function requestHeaders(lang: Lang, auth = false): Record<string, string> {
  const token = auth ? getAuthToken() : null;
  return { Accept: "application/json", "Accept-Language": lang, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// Runs a call that needs the token. When the server answers that the token ran out, the person gets a new one and
// the call runs once more. When that is not possible (the sign in ended too), the first answer stands.
export async function withFreshToken<T>(auth: boolean, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!auth || !(error instanceof ApiError) || error.status !== 401 || error.code !== "TOKEN_EXPIRED") throw error;

    const session = await refreshSession({ retryOnce: true }).catch(() => null);
    if (!session) throw error;
    return run();
  }
}

interface ApiOptions {
  lang: Lang;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
  timeoutMs?: number;
  // send the token of the signed in person (for the endpoints that need one)
  auth?: boolean;
  // GET unless said otherwise
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  // the body, sent as JSON
  json?: unknown;
}

async function request<T>(path: string, { lang, query = {}, signal, timeoutMs = 8000, auth = false, method = "GET", json }: ApiOptions): Promise<T> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const queryString = params.toString();
  const url = `/api${path}${queryString ? `?${queryString}` : ""}`;

  // already cancelled before we start: there is nothing to ask for
  if (signal?.aborted) throw new ApiError("The request was cancelled.");

  // one controller for both the caller's signal and our own timeout
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel);

  try {
    const response = await fetch(url, {
      ...(method === "GET" ? {} : { method }),
      headers: { ...requestHeaders(lang, auth), ...(json === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(json === undefined ? {} : { body: JSON.stringify(json) }),
      signal: controller.signal,
    });
    if (!response.ok) throw errorFrom(response.status, await response.json().catch(() => undefined));
    // "no content": the call worked and there is nothing to read
    if (response.status === 204) return undefined as T;
    try {
      return (await response.json()) as T;
    } catch {
      throw new ApiError("The answer was not valid JSON.", response.status);
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(signal?.aborted ? "The request was cancelled." : "The server could not be reached.");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}

export function apiFetch<T>(path: string, options: ApiOptions): Promise<T> {
  return withFreshToken(options.auth === true, () => request<T>(path, options));
}
