import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { stopOnUncaughtErrors } from "./processErrors.ts";

function setup() {
  const target = Object.assign(new EventEmitter(), { exit: vi.fn() }) as unknown as Parameters<typeof stopOnUncaughtErrors>[1] & EventEmitter;
  const log = { fatal: vi.fn() };
  stopOnUncaughtErrors(log, target);
  return { target, log };
}

describe("errors that nothing caught", () => {
  it("are written to the log and stop the server", () => {
    const { target, log } = setup();
    const error = new Error("a timer broke");

    target.emit("uncaughtException", error);

    expect(log.fatal).toHaveBeenCalledWith({ err: error }, expect.stringContaining("uncaught exception"));
    expect(target.exit).toHaveBeenCalledWith(1);
  });

  it("are the same for a promise that failed and that nobody waited for", () => {
    const { target, log } = setup();

    target.emit("unhandledRejection", "a reason that is not an error");

    expect(log.fatal).toHaveBeenCalledWith({ err: "a reason that is not an error" }, expect.stringContaining("unhandled promise rejection"));
    expect(target.exit).toHaveBeenCalledWith(1);
  });
});
