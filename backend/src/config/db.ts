// The MongoDB connection. The server starts even when the database is not there yet: it keeps trying
// every few seconds, and until it works the routes that need the database answer 503.
import mongoose from "mongoose";

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function connectDb(uri: string): Promise<void> {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
}

export function connectDbWithRetry(uri: string, log: { info(message: string): void; error(fields: object, message: string): void }, retryAfterMs = 10_000) {
  connectDb(uri).then(
    () => log.info("connected to MongoDB"),
    (error: Error) => {
      log.error({ error: error.message }, `could not connect to MongoDB, trying again in ${retryAfterMs / 1000} seconds`);
      setTimeout(() => connectDbWithRetry(uri, log, retryAfterMs), retryAfterMs).unref();
    },
  );
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
