import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { pino } from "pino";
import { pinoHttp } from "pino-http";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { errorHandler } from "./errorHandler.ts";
import { requestId } from "./requestId.ts";
import { checkOrigin, corsFor, noStore } from "./security.ts";

const site = "https://shop.example";
const origins = [site, "http://localhost:5173"];

function build() {
  const app = express();
  app.use(pinoHttp({ logger: pino({ level: "silent" }), genReqId: requestId }));
  app.use(helmet());
  app.use(corsFor(origins));
  app.use(cookieParser());
  app.use(checkOrigin(origins));
  app.use(express.json());
  app.get("/read", (req, res) => void res.json({ id: req.id }));
  app.post("/change", (_req, res) => void res.json({ changed: true }));
  app.delete("/change", (_req, res) => void res.json({ changed: true }));
  app.get("/private", noStore, (_req, res) => void res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

const app = build();

describe("checkOrigin", () => {
  it("lets a change through from our own website", async () => {
    for (const origin of origins) {
      const res = await request(app).post("/change").set("Origin", origin).send({});
      expect(res.status, origin).toBe(200);
    }
  });

  it("refuses a change from another website, with the standard error shape", async () => {
    const res = await request(app).post("/change").set("Origin", "https://evil.example").send({});

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(res.body.error.details).toEqual([]);
  });

  it("refuses PATCH, PUT and DELETE from another website too", async () => {
    const res = await request(app).delete("/change").set("Origin", "https://evil.example");

    expect(res.status).toBe(403);
  });

  it("refuses an Origin that only looks like ours", async () => {
    for (const origin of ["https://shop.example.evil.example", "http://shop.example", "https://shop.example:8443", "null", `${site}/`]) {
      const res = await request(app).post("/change").set("Origin", origin).send({});
      expect(res.status, origin).toBe(403);
    }
  });

  it("lets a change through when there is no Origin, because that is not a browser", async () => {
    const res = await request(app).post("/change").send({});

    expect(res.status).toBe(200);
  });

  it("never blocks a read, whatever the website", async () => {
    const res = await request(app).get("/read").set("Origin", "https://evil.example");

    expect(res.status).toBe(200);
  });
});

describe("corsFor", () => {
  it("lets our website read answers, with cookies", async () => {
    const res = await request(app).get("/read").set("Origin", site);

    expect(res.headers["access-control-allow-origin"]).toBe(site);
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("gives another website no permission to read answers", async () => {
    const res = await request(app).get("/read").set("Origin", "https://evil.example");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("answers the preflight of our website, and lists the headers a page may send", async () => {
    const res = await request(app)
      .options("/change")
      .set("Origin", site)
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "authorization,content-type");

    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe(site);
    expect(res.headers["access-control-allow-headers"]).toMatch(/Authorization/i);
    expect(res.headers["access-control-allow-methods"]).toMatch(/PATCH/);
  });

  it("answers the preflight of an address that does not exist with 404", async () => {
    const res = await request(app).options("/nothing-here").set("Origin", site).set("Access-Control-Request-Method", "POST");

    expect(res.status).toBe(404);
  });

  it("gives the preflight of another website no permission", async () => {
    const res = await request(app).options("/change").set("Origin", "https://evil.example").set("Access-Control-Request-Method", "POST");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("noStore", () => {
  it("tells caches not to keep the answer", async () => {
    const res = await request(app).get("/private");

    expect(res.headers["cache-control"]).toBe("no-store");
  });
});

describe("helmet", () => {
  it("sets the usual security headers and hides the framework", async () => {
    const res = await request(app).get("/read");

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
    expect(res.headers["strict-transport-security"]).toBeDefined();
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("requestId", () => {
  it("gives every request an id, in the log and in the answer", async () => {
    const res = await request(app).get("/read");

    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.id).toBe(res.headers["x-request-id"]);
  });

  it("uses the id the client sent when it looks safe", async () => {
    const res = await request(app).get("/read").set("X-Request-Id", "page-2026-abc123");

    expect(res.headers["x-request-id"]).toBe("page-2026-abc123");
  });

  it("replaces an id that is too short, too long or has odd characters", async () => {
    for (const sent of ["abc", "x".repeat(65), "has space in it", "line\\nbreak-id-1"]) {
      const res = await request(app).get("/read").set("X-Request-Id", sent);
      expect(res.headers["x-request-id"], sent).toMatch(/^[0-9a-f-]{36}$/);
    }
  });
});
