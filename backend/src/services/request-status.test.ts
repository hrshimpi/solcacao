import { describe, expect, it } from "vitest";
import { requestStatuses, type RequestStatus } from "../models/b2b-request.model.ts";
import { canChange, invalidTransition } from "./request-status.ts";

const allowed: [RequestStatus, RequestStatus][] = [
  ["submitted", "quoted"],
  ["quoted", "approved"],
  ["quoted", "rejected"],
  ["submitted", "rejected"],
];

const everyPair = requestStatuses.flatMap((from) => requestStatuses.map((to) => [from, to] as const));
const refused = everyPair.filter(([from, to]) => !allowed.some(([a, b]) => a === from && b === to));

describe("canChange", () => {
  it.each(allowed)("lets %s change to %s", (from, to) => {
    expect(canChange(from, to)).toBe(true);
  });

  it.each(refused)("does not let %s change to %s", (from, to) => {
    expect(canChange(from, to)).toBe(false);
  });

  it("covers every pair of statuses: 4 allowed and 12 refused", () => {
    expect(everyPair).toHaveLength(16);
    expect(allowed).toHaveLength(4);
    expect(refused).toHaveLength(12);
  });
});

describe("invalidTransition", () => {
  it("is a 400 with the code INVALID_TRANSITION and the status as the field", () => {
    const error = invalidTransition("submitted", "approved");

    expect(error).toMatchObject({ status: 400, code: "INVALID_TRANSITION" });
    expect(error.details).toEqual([{ field: "status", message: error.message }]);
  });

  it("says where the request can go from here", () => {
    expect(invalidTransition("submitted", "approved").message).toBe("A submitted request can't be changed to approved. It can only move to quoted or rejected.");
    expect(invalidTransition("quoted", "submitted").message).toBe("A quoted request can't be changed to submitted. It can only move to approved or rejected.");
    expect(invalidTransition("quoted", "quoted").message).toBe("A quoted request can't be changed to quoted. It can only move to approved or rejected.");
  });

  it("says that approved and rejected requests are final", () => {
    expect(invalidTransition("approved", "quoted").message).toBe("A request that is approved is final and can't be changed.");
    expect(invalidTransition("rejected", "submitted").message).toBe("A request that is rejected is final and can't be changed.");
  });
});
