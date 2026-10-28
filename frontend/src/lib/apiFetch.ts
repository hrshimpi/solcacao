// A small helper for calling our own API (everything under /api). It sends the current language in the
// Accept-Language header, gives up after a few seconds, and turns every kind of failure (no network, a bad
// status, an answer that is not JSON) into one ApiError, so screens only need one catch.
import type { Lang } from "../i18n";
import { getAuthToken } from "./authToken";

export class ApiError extends Error {
  // the HTTP status, or 0 when there was no answer at all
  status: number;
  // the code from the server's error answer (like RATE_LIMITED), when the answer had one
  code: string | undefined;

  constructor(message: string, status = 0, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

// the standard error answer of the server is { error: { code, message, details } }. Anything else only gives the status.
export function errorFrom(status: number, body: unknown) {
  const error = typeof body === "object" && body !== null ? (body as { error?: unknown }).error : undefined;
  const { code, message } = typeof error === "object" && error !== null ? (error as { code?: unknown; message?: unknown }) : {};

  if (typeof message === "string" && message) return new ApiError(message, status, typeof code === "string" ? code : undefined);
  return new ApiError(`The server answered ${status}.`, status);
}

// the headers every call sends. The token is only sent when the call asks for it, so public calls never carry it.
export function requestHeaders(lang: Lang, auth = false): Record<string, string> {
  const token = auth ? getAuthToken() : null;
  return { Accept: "application/json", "Accept-Language": lang, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface ApiOptions {
  lang: Lang;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
  timeoutMs?: number;
  // send the token of the signed in person (for the endpoints that need one)
  auth?: boolean;
}

export async function apiFetch<T>(path: string, { lang, query = {}, signal, timeoutMs = 8000, auth = false }: ApiOptions): Promise<T> {
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
      headers: requestHeaders(lang, auth),
      signal: controller.signal,
    });
    if (!response.ok) throw errorFrom(response.status, await response.json().catch(() => undefined));
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
