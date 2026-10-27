// Turns a failed zod check into our standard error. The first problem is the message (it is written
// for people), every problem is in details with the name of the field it belongs to.
import type { ZodError, ZodType, output } from "zod";
import { AppError } from "./AppError.ts";

export interface FieldProblem {
  field: string;
  message: string;
}

export function validationError(error: ZodError): AppError {
  const details: FieldProblem[] = error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message }));
  return new AppError("VALIDATION_ERROR", 400, details[0]?.message ?? "Some of the information isn't valid.", details);
}

// checks data against a schema and returns the cleaned result, or throws the standard error
export function parseOrThrow<T extends ZodType>(schema: T, data: unknown): output<T> {
  const result = schema.safeParse(data);
  if (!result.success) throw validationError(result.error);
  return result.data;
}
