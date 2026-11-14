// Every error ends up here and leaves in the standard shape { error: { code, message, details } }.
// What we know how to explain gets a clear answer. Anything else is a 500 with no details at all: the real error is
// only written to the log (with the id of the request, so it can be found), never sent to the person.
import type { ErrorRequestHandler } from "express";
import { AppError } from "../errors/AppError.ts";

function send(
  res: Parameters<ErrorRequestHandler>[2],
  status: number,
  code: string,
  message: string,
  details: unknown[] = [],
) {
  res.status(status).json({ error: { code, message, details } });
}

type Known = { code?: unknown; name?: unknown; type?: unknown; status?: unknown; expose?: unknown; errors?: unknown };

// the names MongoDB and mongoose give to "the database is not reachable"
const unreachable = new Set(["MongoNetworkError", "MongoNetworkTimeoutError", "MongooseServerSelectionError", "MongoServerSelectionError", "MongoPoolClearedError"]);

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    send(res, err.status, err.code, err.message, err.details);
    return;
  }

  const known: Known = typeof err === "object" && err !== null ? err : {};

  if (known.type === "entity.parse.failed") {
    send(res, 400, "INVALID_JSON", "The request body isn't valid JSON.");
    return;
  }

  if (known.type === "entity.too.large") {
    send(res, 413, "PAYLOAD_TOO_LARGE", "The request body is too large.");
    return;
  }

  if (known.type === "charset.unsupported" || known.type === "encoding.unsupported") {
    send(res, 415, "UNSUPPORTED_MEDIA_TYPE", "We can't read the way that request was encoded.");
    return;
  }

  // a unique index said no: two requests made the same thing, or something that exists was made again
  if (known.code === 11000) {
    send(res, 409, "CONFLICT", "That already exists.");
    return;
  }

  // an id in the address that is not an id MongoDB could make
  if (known.name === "CastError") {
    send(res, 400, "INVALID_ID", "That id isn't valid.");
    return;
  }

  // a value that the model refused, with the field it was about
  if (known.name === "ValidationError" && typeof known.errors === "object" && known.errors !== null) {
    const details = Object.entries(known.errors as Record<string, { message?: unknown }>).map(([field, problem]) => ({
      field,
      message: typeof problem?.message === "string" ? problem.message : "That isn't valid.",
    }));
    send(res, 400, "VALIDATION_ERROR", details[0]?.message ?? "Some of the information isn't valid.", details);
    return;
  }

  if (typeof known.name === "string" && unreachable.has(known.name)) {
    req.log.error({ err }, "the database is not reachable");
    send(res, 503, "DATABASE_UNAVAILABLE", "We can't reach the database right now. Please try again in a moment.");
    return;
  }

  // a request that the server's own parts refused (a body that was cut off, a bad header): the person's fault, not ours
  if (typeof known.status === "number" && known.status >= 400 && known.status < 500 && known.expose === true) {
    send(res, known.status, "BAD_REQUEST", "We couldn't read that request.");
    return;
  }

  req.log.error({ err }, "unhandled error");
  send(res, 500, "INTERNAL_ERROR", "Something went wrong on our side.");
};
