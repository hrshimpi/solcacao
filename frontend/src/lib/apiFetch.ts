// A small helper for calling our own API (everything under /api). It sends the current language in the
// Accept-Language header, gives up after a few seconds, and turns every kind of failure (no network, a bad
// status, an answer that is not JSON) into one ApiError, so screens only need one catch.
import type { Lang } from "../i18n";

export class ApiError extends Error {
  // the HTTP status, or 0 when there was no answer at all
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface ApiOptions {
  lang: Lang;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function apiFetch<T>(path: string, { lang, query = {}, signal, timeoutMs = 8000 }: ApiOptions): Promise<T> {
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
      headers: { Accept: "application/json", "Accept-Language": lang },
      signal: controller.signal,
    });
    if (!response.ok) throw new ApiError(`The server answered ${response.status}.`, response.status);
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
