// The last safety net: an error that nothing caught, or a promise that failed and nobody waited for it. Express catches the
// errors of the routes, so these come from code that runs on its own (a timer, a callback). The server writes down what
// happened and stops, so the host starts a clean one, instead of going on in a state that nobody knows.
import type { Logger } from "pino";

type ProcessLike = Pick<NodeJS.Process, "on" | "exit">;

export function stopOnUncaughtErrors(log: Pick<Logger, "fatal">, target: ProcessLike = process) {
  target.on("uncaughtException", (error) => {
    log.fatal({ err: error }, "uncaught exception, stopping");
    target.exit(1);
  });
  target.on("unhandledRejection", (reason) => {
    log.fatal({ err: reason }, "unhandled promise rejection, stopping");
    target.exit(1);
  });
}
