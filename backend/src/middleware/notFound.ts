import type { RequestHandler } from "express";
import { AppError } from "../errors/AppError.ts";

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new AppError("NOT_FOUND", 404, "That endpoint doesn't exist."));
};
