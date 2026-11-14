// /api/health        is the server running? A monitor calls it all day, so it never asks the database anything. It says whether
//                    the database is connected, so a person looking at it can tell why the other routes answer 503.
// /api/health/ready  can the server do its work? 503 (the standard error shape) until the database is connected, for a host
//                    that waits for this before it sends visitors.
// Neither is counted by the rate limit, and neither is kept by a cache.
import { Router } from "express";
import { isDatabaseReady, requireDatabase } from "../config/db.ts";
import { noStore } from "../middleware/security.ts";

export const healthRouter = Router();

healthRouter.get("/health", noStore, (_req, res) => {
  res.json({ status: "ok", uptime: Math.round(process.uptime()), database: isDatabaseReady() ? "up" : "down" });
});

healthRouter.get("/health/ready", noStore, (_req, res) => {
  requireDatabase();
  res.json({ status: "ready", uptime: Math.round(process.uptime()), database: "up" });
});
