import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError } from "./AppError.ts";
import { parseOrThrow, validationError } from "./validationError.ts";

const schema = z.object({
  name: z.string({ error: "Please enter your name." }).min(2, "Your name needs at least 2 characters."),
  address: z.object({ city: z.string({ error: "Please enter your city." }) }),
});

describe("validationError", () => {
  it("is a 400 in the standard shape, with every problem in details", () => {
    const result = schema.safeParse({});
    const error = validationError(result.error!);

    expect(error).toBeInstanceOf(AppError);
    expect(error.status).toBe(400);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      { field: "name", message: "Please enter your name." },
      { field: "address", message: "Invalid input: expected object, received undefined" },
    ]);
  });

  it("uses the first problem as the message", () => {
    expect(validationError(schema.safeParse({ name: "A", address: { city: "Austin" } }).error!).message).toBe("Your name needs at least 2 characters.");
  });

  it("names fields inside other objects with a dot", () => {
    const error = validationError(schema.safeParse({ name: "Isabel", address: {} }).error!);

    expect(error.details).toEqual([{ field: "address.city", message: "Please enter your city." }]);
  });
});

describe("parseOrThrow", () => {
  it("returns the cleaned data", () => {
    expect(parseOrThrow(schema, { name: "Isabel", address: { city: "Austin" }, extra: true })).toEqual({ name: "Isabel", address: { city: "Austin" } });
  });

  it("throws the standard error when the data is not valid", () => {
    expect(() => parseOrThrow(schema, { name: "I" })).toThrowError(AppError);
  });
});
