import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.ts";
import { logger } from "./logger.ts";
import { errorHandler } from "./middleware/errorHandler.ts";
import { notFound } from "./middleware/notFound.ts";
import { createRateLimiter } from "./middleware/rateLimit.ts";
import { requestId } from "./middleware/requestId.ts";
import { checkOrigin, corsFor } from "./middleware/security.ts";
import { apiRouter } from "./routes/index.ts";

// Everything that every request goes through, in the order it matters:
// the id and the log, the security headers, who may talk to us from a browser, a limit on how much one visitor can ask,
// cookies, the check that a change comes from our own website, and only then the body and the routes.
export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY);
  app.use(
    pinoHttp({
      logger,
      genReqId: requestId,
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res) => ({ status: res.statusCode }),
      },
    }),
  );
  app.use(helmet());
  app.use("/api", corsFor(env.CLIENT_ORIGINS));
  app.use(
    "/api",
    createRateLimiter({
      limit: env.RATE_LIMIT_MAX,
      windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
      message: "You are sending a lot of requests. Please slow down and try again in a few minutes.",
      countFailedRequests: true,
      skip: (req) => req.path === "/health" || req.method === "OPTIONS",
    }),
  );
  app.use(cookieParser());
  app.use("/api", checkOrigin(env.CLIENT_ORIGINS));
  app.use(express.json({ limit: "100kb" }));

  app.use("/api", apiRouter);
  app.use("/api", notFound);
  app.use(errorHandler);

  return app;
}
