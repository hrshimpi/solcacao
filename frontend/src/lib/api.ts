// Calls to our own API for the endpoints of a signed in person. They all send the language and the token, and turn
// every kind of failure (no network, a bad status, an answer that is not JSON) into one ApiError.
//   api.get       reads JSON, like apiFetch, with the token
//   api.upload    sends a form with files and reports the progress while the files go up, which fetch cannot do
//   api.download  fetches a file with the token, as a Blob, because a plain link cannot send the Authorization header
import type { Lang } from "../i18n";
import { ApiError, apiFetch, errorFrom, requestHeaders } from "./apiFetch";
import { getAuthToken } from "./authToken";

interface UploadOptions {
  lang: Lang;
  // called with a number from 0 to 1 while the form goes up. It reaches 1 when everything was sent, and the server may still be working.
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
  // The one status that means the request worked, like 201 for a request that creates something. Any other 2xx is
  // refused. Without it every 2xx counts, which is a risk when something between the page and the server answers for
  // it, like a host that sends every address its home page with a 200.
  successStatus?: number;
}

interface GetOptions {
  lang: Lang;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
  timeoutMs?: number;
}

function get<T>(path: string, options: GetOptions): Promise<T> {
  return apiFetch<T>(path, { ...options, auth: true });
}

async function download(path: string, { lang, signal }: { lang: Lang; signal?: AbortSignal }): Promise<Blob> {
  if (signal?.aborted) throw new ApiError("The request was cancelled.");

  try {
    const response = await fetch(`/api${path}`, { headers: requestHeaders(lang, true), signal });
    if (!response.ok) throw errorFrom(response.status, await response.json().catch(() => undefined));
    return await response.blob();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(signal?.aborted ? "The request was cancelled." : "The server could not be reached.");
  }
}

function upload<T>(path: string, body: FormData, { lang, onProgress, signal, successStatus }: UploadOptions): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    // already cancelled before we start: there is nothing to send
    if (signal?.aborted) {
      reject(new ApiError("The request was cancelled."));
      return;
    }

    const request = new XMLHttpRequest();
    request.open("POST", `/api${path}`);
    request.setRequestHeader("Accept", "application/json");
    request.setRequestHeader("Accept-Language", lang);
    // no Content-Type here: the browser writes it with the boundary that separates the parts of the form
    const token = getAuthToken();
    if (token) request.setRequestHeader("Authorization", `Bearer ${token}`);

    const cancel = () => request.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    const finish = () => signal?.removeEventListener("abort", cancel);

    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress?.(event.loaded / event.total);
    };
    request.upload.onload = () => onProgress?.(1);

    request.onload = () => {
      finish();
      let answer: unknown;
      let isJson = true;
      try {
        answer = JSON.parse(request.responseText);
      } catch {
        isJson = false;
      }

      if (request.status >= 200 && request.status < 300) {
        if (successStatus !== undefined && request.status !== successStatus) {
          reject(new ApiError(`The server answered ${request.status}, which is not the answer to this request.`, request.status));
        } else if (isJson) resolve(answer as T);
        else reject(new ApiError("The answer was not valid JSON.", request.status));
      } else {
        reject(errorFrom(request.status, answer));
      }
    };
    request.onerror = () => {
      finish();
      reject(new ApiError("The server could not be reached."));
    };
    request.onabort = () => {
      finish();
      reject(new ApiError("The request was cancelled."));
    };

    request.send(body);
  });
}

export const api = { get, upload, download };
