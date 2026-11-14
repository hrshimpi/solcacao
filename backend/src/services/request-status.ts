// Which way a quote request can move. It starts as submitted, gets a quote, and the answer ends it:
//   submitted -> quoted | rejected
//   quoted    -> approved | rejected
// Approved and rejected are final.
import { AppError } from "../errors/AppError.ts";
import type { RequestStatus } from "../models/b2b-request.model.ts";

const nextStatuses: Record<RequestStatus, readonly RequestStatus[]> = {
  submitted: ["quoted", "rejected"],
  quoted: ["approved", "rejected"],
  approved: [],
  rejected: [],
};

export function canChange(from: RequestStatus, to: RequestStatus): boolean {
  return nextStatuses[from].includes(to);
}

export function invalidTransition(from: RequestStatus, to: RequestStatus): AppError {
  const next = nextStatuses[from];
  const message =
    next.length === 0
      ? `A request that is ${from} is final and can't be changed.`
      : `A ${from} request can't be changed to ${to}. It can only move to ${next.join(" or ")}.`;
  return new AppError("INVALID_TRANSITION", 400, message, [{ field: "status", message }]);
}
