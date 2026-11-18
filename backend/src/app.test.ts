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

  it("answers on /api/health, and says that the database is not connected (there is none in this test)", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.uptime).toBe("number");
    expect(res.body.database).toBe("down");
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("answers 503 on /api/health/ready until the database is connected, in the standard error shape", async () => {
    const res = await request(app).get("/api/health/ready");

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("DATABASE_UNAVAILABLE");
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("does not keep the other answers out of the cache because of the health check", async () => {
    const res = await request(app).get("/api/nothing-here");

    expect(res.headers["cache-control"]).not.toBe("no-store");
  });

  it("does not count the health checks against the limit of requests, and counts the other requests", async () => {
    for (const path of ["/api/health", "/api/health/ready"]) {
      expect((await request(app).get(path)).headers["ratelimit"], path).toBeUndefined();
    }
    expect((await request(app).get("/api/nothing-here")).headers["ratelimit"]).toBeDefined();
  });

  it("uses the standard error shape for unknown endpoints", async () => {
    const res = await request(app).get("/api/nothing-here");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  it("answers 413 in the standard shape for a JSON body that is too big, before anything else looks at it", async () => {
    const res = await request(app)
      .post("/api/b2b/quote")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ notes: "x".repeat(300_000) }));

    expect(res.status).toBe(413);
    expect(res.body.error).toEqual({ code: "PAYLOAD_TOO_LARGE", message: "The request body is too large.", details: [] });
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

describe("error handler: errors from the database and the request parser", () => {
  const app = express();
  app.use(pinoHttp({ logger }));
  const fail = (path: string, error: unknown) =>
    app.get(path, () => {
      throw error;
    });
  fail("/duplicate", Object.assign(new Error("E11000 duplicate key error, dup key: { email: \"isabel@example.com\" }"), { code: 11000 }));
  fail("/bad-id", Object.assign(new Error('Cast to ObjectId failed for value "abc"'), { name: "CastError" }));
  fail(
    "/invalid",
    Object.assign(new Error("User validation failed"), {
      name: "ValidationError",
      errors: { name: { message: "Path `name` is required." }, phone: { message: "phone must look like a phone number" } },
    }),
  );
  fail("/down", Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:27017"), { name: "MongooseServerSelectionError" }));
  fail("/aborted", Object.assign(new Error("request aborted"), { status: 400, expose: true, type: "request.aborted" }));
  fail("/encoding", Object.assign(new Error("unsupported charset"), { status: 415, type: "charset.unsupported" }));
  fail("/server-says-4xx", Object.assign(new Error("secret internal reason"), { status: 418, expose: false }));
  app.use(errorHandler);

  it("answers 409 CONFLICT for a unique index that said no, without the value that clashed", async () => {
    const res = await request(app).get("/duplicate");

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
    expect(JSON.stringify(res.body)).not.toContain("isabel@example.com");
  });

  it("answers 400 INVALID_ID for an id that is not an id", async () => {
    const res = await request(app).get("/bad-id");

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({ code: "INVALID_ID", message: "That id isn't valid.", details: [] });
  });

  it("answers 400 VALIDATION_ERROR for a model that refused a value, with the field of each problem", async () => {
    const res = await request(app).get("/invalid");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual([
      { field: "name", message: "Path `name` is required." },
      { field: "phone", message: "phone must look like a phone number" },
    ]);
  });

  it("answers 503 DATABASE_UNAVAILABLE when the database cannot be reached, without the address", async () => {
    const res = await request(app).get("/down");

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("DATABASE_UNAVAILABLE");
    expect(JSON.stringify(res.body)).not.toContain("27017");
  });

  it("answers a request that the parser refused as the person's problem, in a generic way", async () => {
    const res = await request(app).get("/aborted");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });

  it("answers 415 for an encoding it cannot read", async () => {
    const res = await request(app).get("/encoding");

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("does not pass on the reason of a 4xx that the library does not mark as safe to show", async () => {
    const res = await request(app).get("/server-says-4xx");

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("secret internal reason");
  });
});

describe("api security", () => {
  const app = createApp();

  it("sends the security headers and the id of the request", async () => {
    const res = await request(app).get("/api/health");

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-request-id"]).toBeTruthy();
  });

  it("refuses a change from a website that is not ours, before any route runs", async () => {
    const res = await request(app).post("/api/auth/login").set("Origin", "https://evil.example").send({ email: "a@b.co", password: "x" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("does not answer a preflight outside the API", async () => {
    const res = await request(app).options("/somewhere").set("Origin", "http://localhost:5173").set("Access-Control-Request-Method", "POST");

    expect(res.status).toBe(404);
  });
});
