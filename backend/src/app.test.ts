import express from "express";
import { pinoHttp } from "pino-http";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.ts";
import { AppError } from "./errors/AppError.ts";
import { logger } from "./logger.ts";
import { errorHandler } from "./middleware/errorHandler.ts";

describe("api", () => {
  const app = createApp();

  it("answers on /api/health", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.uptime).toBe("number");
  });

  it("uses the standard error shape for unknown endpoints", async () => {
    const res = await request(app).get("/api/nothing-here");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  it("rejects a body that isn't valid json", async () => {
    const res = await request(app)
      .post("/api/health")
      .set("Content-Type", "application/json")
      .send("{not json");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });
});

describe("error handler", () => {
  const app = express();
  app.use(pinoHttp({ logger }));
  app.get("/known", () => {
    throw new AppError("EMAIL_TAKEN", 409, "That email already has an account.");
  });
  app.get("/unknown", () => {
    throw new Error("database password is hunter2");
  });
  app.use(errorHandler);

  it("passes our own errors through with their status and code", async () => {
    const res = await request(app).get("/known");

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: "EMAIL_TAKEN",
      message: "That email already has an account.",
      details: [],
    });
  });

  it("hides the details of unexpected errors", async () => {
    const res = await request(app).get("/unknown");

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(res.body)).not.toContain("hunter2");
  });
});
