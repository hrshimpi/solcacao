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

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    send(res, err.status, err.code, err.message, err.details);
    return;
  }

  if (err?.type === "entity.parse.failed") {
    send(res, 400, "INVALID_JSON", "The request body isn't valid JSON.");
    return;
  }

  if (err?.type === "entity.too.large") {
    send(res, 413, "PAYLOAD_TOO_LARGE", "The request body is too large.");
    return;
  }

  req.log.error({ err }, "unhandled error");
  send(res, 500, "INTERNAL_ERROR", "Something went wrong on our side.");
};
