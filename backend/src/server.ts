import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createApp } from "./app.ts";
import { connectDbWithRetry, disconnectDb } from "./config/db.ts";
import { env } from "./config/env.ts";
import { logger } from "./logger.ts";
import { stopOnUncaughtErrors } from "./processErrors.ts";

stopOnUncaughtErrors(logger);

const app = createApp();

// the folder for uploaded files exists before the first upload
await mkdir(path.resolve(env.UPLOAD_DIR), { recursive: true });

// the server starts without waiting for the database, the routes that need it answer 503 until it is there
connectDbWithRetry(env.MONGODB_URI, logger);

// in production only Nginx on this machine may reach the API, so it listens on the loopback address only
const onListening = () => logger.info(`API listening on port ${env.PORT}`);
const server = env.NODE_ENV === "production" ? app.listen(env.PORT, "127.0.0.1", onListening) : app.listen(env.PORT, onListening);

function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  // a connection that stays open must not keep the server from stopping
  setTimeout(() => process.exit(1), 10_000).unref();
  server.close(() => {
    disconnectDb().finally(() => process.exit(0));
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
