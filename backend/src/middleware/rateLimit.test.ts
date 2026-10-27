import express from "express";
import { pino } from "pino";
import { pinoHttp } from "pino-http";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { errorHandler } from "./errorHandler.ts";
import { createRateLimiter } from "./rateLimit.ts";

function appWith(options: { limit: number; windowMs?: number }) {
  const app = express();
  app.set("trust proxy", "loopback");
  app.use(pinoHttp({ logger: pino({ level: "silent" }) }));
  app.get("/ok", createRateLimiter({ limit: options.limit, windowMs: options.windowMs ?? 60_000, message: "Slow down." }), (_req, res) => void res.json({ ok: true }));
  app.get("/fail", createRateLimiter({ limit: options.limit, windowMs: 60_000, message: "Slow down." }), (_req, res) => void res.status(400).json({ ok: false }));
  app.use(errorHandler);
  return app;
}

describe("createRateLimiter", () => {
  it("lets the allowed number of requests through, then answers 429 in the standard shape", async () => {
    const app = appWith({ limit: 3 });

    for (let i = 0; i < 3; i++) expect((await request(app).get("/ok")).status).toBe(200);
    const res = await request(app).get("/ok");

    expect(res.status).toBe(429);
    expect(res.body.error).toEqual({ code: "RATE_LIMITED", message: "Slow down.", details: [] });
  });

  it("says when to try again", async () => {
    const app = appWith({ limit: 1 });
    await request(app).get("/ok");

    const res = await request(app).get("/ok");

    expect(res.status).toBe(429);
    expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
    expect(Number(res.headers["retry-after"])).toBeLessThanOrEqual(60);
  });

  it("keeps counting separately for each IP address", async () => {
    const app = appWith({ limit: 2 });

    for (let i = 0; i < 2; i++) await request(app).get("/ok").set("X-Forwarded-For", "10.0.0.1");

    expect((await request(app).get("/ok").set("X-Forwarded-For", "10.0.0.1")).status).toBe(429);
    expect((await request(app).get("/ok").set("X-Forwarded-For", "10.0.0.2")).status).toBe(200);
  });

  it("does not count requests that failed", async () => {
    const app = appWith({ limit: 2 });

    for (let i = 0; i < 6; i++) expect((await request(app).get("/fail")).status).toBe(400);
  });

  it("starts again when the time is up", async () => {
    const app = appWith({ limit: 1, windowMs: 200 });
    await request(app).get("/ok");
    expect((await request(app).get("/ok")).status).toBe(429);

    await new Promise((resolve) => setTimeout(resolve, 350));

    expect((await request(app).get("/ok")).status).toBe(200);
  });
});
