// What goes wrong when we call our own API, in one shape. The server answers every problem as
// { error: { code, message, details } }, and a failure with no answer at all (no network) has status 0.

// a problem with one field, as the server names it ({ field: "email", message: "..." }), or a number it asks us to use
// (available: how many there can be, for INSUFFICIENT_STOCK)
export interface ApiErrorDetail {
  field?: string;
  message?: string;
  available?: number;
}

export class ApiError extends Error {
  // the HTTP status, or 0 when there was no answer at all
  status: number;
  // the code from the server's error answer (like RATE_LIMITED), when the answer had one
  code: string | undefined;
  // the details of the answer: a problem for each field that was wrong
  details: ApiErrorDetail[];

  constructor(message: string, status = 0, code?: string, details: ApiErrorDetail[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function readDetails(value: unknown): ApiErrorDetail[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      ...(typeof item.field === "string" ? { field: item.field } : {}),
      ...(typeof item.message === "string" ? { message: item.message } : {}),
      ...(typeof item.available === "number" ? { available: item.available } : {}),
    }));
}

// the standard error answer of the server is { error: { code, message, details } }. Anything else only gives the status.
export function errorFrom(status: number, body: unknown) {
  const error = typeof body === "object" && body !== null ? (body as { error?: unknown }).error : undefined;
  const { code, message, details } = typeof error === "object" && error !== null ? (error as { code?: unknown; message?: unknown; details?: unknown }) : {};

  if (typeof message === "string" && message) return new ApiError(message, status, typeof code === "string" ? code : undefined, readDetails(details));
  return new ApiError(`The server answered ${status}.`, status);
}
