import pino from "pino";
import { env } from "./config/env.ts";

// What is never written to the log, whatever a line of code puts into it: passwords, tokens and cookies, at the top of an
// object and one level down (like { user: { password } } or { body: { token } }). The request is logged without its headers
// anyway (see app.ts), this is for the day somebody logs more than they should.
const secretNames = ["password", "newPassword", "currentPassword", "token", "accessToken", "refreshToken", "authorization", "cookie"];
export const redactPaths = [
  ...secretNames,
  ...secretNames.map((name) => `*.${name}`),
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers['set-cookie']",
];

export function createLogger(level: string, destination?: pino.DestinationStream) {
  return pino(
    {
      level,
      redact: { paths: redactPaths, censor: "[hidden]" },
      transport: !destination && env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
    },
    destination,
  );
}

export const logger = createLogger(env.NODE_ENV === "test" ? "silent" : env.LOG_LEVEL);
