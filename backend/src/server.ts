import { createApp } from "./app.ts";
import { connectDbWithRetry, disconnectDb } from "./config/db.ts";
import { env } from "./config/env.ts";
import { logger } from "./logger.ts";

const app = createApp();

// the server starts without waiting for the database, the routes that need it answer 503 until it is there
connectDbWithRetry(env.MONGODB_URI, logger);

const server = app.listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${env.PORT}`);
});

function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close(() => {
    disconnectDb().finally(() => process.exit(0));
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
