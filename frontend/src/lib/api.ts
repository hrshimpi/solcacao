// Calls to our own API that need more than apiFetch does. api.upload sends a form with files and reports the
// progress while the files go up, which fetch cannot do. Like apiFetch it sends the language and turns every kind of
// failure (no network, a bad status, an answer that is not JSON) into one ApiError. It also sends the token of the
// person who is signed in, for the endpoints that need one.
import type { Lang } from "../i18n";
import { ApiError } from "./apiFetch";
import { getAuthToken } from "./authToken";

interface UploadOptions {
  lang: Lang;
  // called with a number from 0 to 1 while the form goes up. It reaches 1 when everything was sent, and the server may still be working.
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

// the standard error answer of the server is { error: { code, message, details } }
function errorFrom(status: number, body: unknown) {
  const error = typeof body === "object" && body !== null ? (body as { error?: unknown }).error : undefined;
  const { code, message } = typeof error === "object" && error !== null ? (error as { code?: unknown; message?: unknown }) : {};

  if (typeof message === "string" && message) return new ApiError(message, status, typeof code === "string" ? code : undefined);
  return new ApiError(`The server answered ${status}.`, status);
}

function upload<T>(path: string, body: FormData, { lang, onProgress, signal }: UploadOptions): Promise<T> {
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
        if (isJson) resolve(answer as T);
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

export const api = { upload };
