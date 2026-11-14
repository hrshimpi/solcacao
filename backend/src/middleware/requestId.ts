// Every request gets an id that shows up in the logs and in the X-Request-Id header of the answer, so a problem
// a person reports can be found in the logs. The id the client sent is used when it looks safe, anything else
// (very long, or with characters that could mess up a log line) is replaced.
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

const safeId = /^[\w.-]{8,64}$/;

export function requestId(req: IncomingMessage, res: ServerResponse): string {
  const sent = req.headers["x-request-id"];
  const id = typeof sent === "string" && safeId.test(sent) ? sent : randomUUID();
  res.setHeader("X-Request-Id", id);
  return id;
}
