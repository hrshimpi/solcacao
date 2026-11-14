import { describe, expect, it } from "vitest";
import { requestStatuses } from "../models/b2b-request.model.ts";
import { requestIdSchema, requestListQuerySchema, statusChangeSchema } from "./b2b-requests.schema.ts";

function problems(schema: { safeParse(data: unknown): { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } }, data: unknown): string[] {
  const result = schema.safeParse(data);
  return result.success ? [] : result.error!.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
}

function parsed<T>(schema: { safeParse(data: unknown): { success: boolean; data?: T } }, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new Error(`should have been valid: ${problems(schema as never, data).join(", ")}`);
  return result.data as T;
}

describe("request list query", () => {
  it("starts at page 1 with 20 on a page", () => {
    expect(parsed(requestListQuerySchema, {})).toEqual({ page: 1, limit: 20 });
  });

  it("reads the numbers from the address", () => {
    expect(parsed(requestListQuerySchema, { page: "3", limit: "50" })).toEqual({ page: 3, limit: 50 });
  });

  it("accepts the smallest and the largest limit", () => {
    expect(parsed(requestListQuerySchema, { limit: "1" }).limit).toBe(1);
    expect(parsed(requestListQuerySchema, { limit: "100" }).limit).toBe(100);
  });

  it("says what is wrong with the page and the limit", () => {
    expect(problems(requestListQuerySchema, { page: "0" })).toEqual(["page: page starts at 1."]);
    expect(problems(requestListQuerySchema, { page: "1.5" })).toEqual(["page: page must be a whole number."]);
    expect(problems(requestListQuerySchema, { page: "two" })).toEqual(["page: page must be a number."]);
    expect(problems(requestListQuerySchema, { limit: "0" })).toEqual(["limit: limit must be at least 1."]);
    expect(problems(requestListQuerySchema, { limit: "101" })).toEqual(["limit: limit can be at most 100."]);
    expect(problems(requestListQuerySchema, { limit: "many" })).toEqual(["limit: limit must be a number."]);
  });

  it("ignores other things in the address", () => {
    expect(parsed(requestListQuerySchema, { page: "2", status: "quoted", userId: "someone" })).toEqual({ page: 2, limit: 20 });
  });
});

describe("request id", () => {
  it("accepts the id MongoDB makes", () => {
    expect(problems(requestIdSchema, "64b7f0c2a1b2c3d4e5f60718")).toEqual([]);
    expect(problems(requestIdSchema, "64B7F0C2A1B2C3D4E5F60718")).toEqual([]);
  });

  it.each(["", "abc", "64b7f0c2a1b2c3d4e5f6071", "64b7f0c2a1b2c3d4e5f607189", "64b7f0c2a1b2c3d4e5f6071g", "../etc/passwd", "{ $ne: null }"])("refuses %j", (id) => {
    expect(problems(requestIdSchema, id)).toEqual([": That isn't a valid request id."]);
  });
});

describe("status change: a valid change", () => {
  it("takes approved and rejected without a price", () => {
    for (const status of ["approved", "rejected"]) {
      expect(parsed(statusChangeSchema, { status })).toEqual({ status });
    }
  });

  it("quotes with an amount in cents, and a note if there is one", () => {
    expect(parsed(statusChangeSchema, { status: "quoted", quoteAmount: 125000 })).toEqual({ status: "quoted", quoteAmount: 125000 });
    expect(parsed(statusChangeSchema, { status: "quoted", quoteAmount: 1, quoteNote: "Includes shipping." })).toEqual({
      status: "quoted",
      quoteAmount: 1,
      quoteNote: "Includes shipping.",
    });
  });

  it("allows a note with any status", () => {
    expect(parsed(statusChangeSchema, { status: "rejected", quoteNote: "We cannot make that size." }).quoteNote).toBe("We cannot make that size.");
  });

  it("strips HTML from the note, and treats an empty note as none", () => {
    expect(parsed(statusChangeSchema, { status: "rejected", quoteNote: "<b>Sorry</b> <script>alert(1)</script>about that" }).quoteNote).toBe("Sorry about that");
    expect(parsed(statusChangeSchema, { status: "rejected", quoteNote: "   " })).not.toHaveProperty("quoteNote", expect.anything());
  });

  it("drops fields that nobody may set this way", () => {
    const result = parsed(statusChangeSchema, { status: "rejected", userId: "64b7f0c2a1b2c3d4e5f60718", brandAssets: ["x"], id: "mine", companyName: "Other" });

    expect(Object.keys(result)).toEqual(["status"]);
  });

  it("accepts the largest amount", () => {
    expect(problems(statusChangeSchema, { status: "quoted", quoteAmount: 10_000_000_000 })).toEqual([]);
  });
});

describe("status change: what is wrong", () => {
  it("needs a status", () => {
    expect(problems(statusChangeSchema, {})).toEqual([`status: status must be one of: ${requestStatuses.join(", ")}.`]);
    expect(problems(statusChangeSchema, { quoteAmount: 5000 })).toEqual([`status: status must be one of: ${requestStatuses.join(", ")}.`]);
  });

  it.each(["done", "Quoted", "QUOTED", "", " quoted", 1, null, ["quoted"]])("refuses the status %j", (status) => {
    expect(problems(statusChangeSchema, { status, quoteAmount: 5000 })).toEqual([`status: status must be one of: ${requestStatuses.join(", ")}.`]);
  });

  it("asks for an amount when the status is quoted", () => {
    expect(problems(statusChangeSchema, { status: "quoted" })).toEqual(["quoteAmount: A quoted request needs a quoteAmount, in cents."]);
    expect(problems(statusChangeSchema, { status: "quoted", quoteNote: "Soon." })).toEqual(["quoteAmount: A quoted request needs a quoteAmount, in cents."]);
  });

  it.each(["approved", "rejected", "submitted"])("does not take an amount with the status %s", (status) => {
    expect(problems(statusChangeSchema, { status, quoteAmount: 5000 })).toEqual(["quoteAmount: The quoteAmount can only be set when the status is quoted."]);
  });

  it.each([0, -1, -5000])("needs at least 1 cent: %j", (quoteAmount) => {
    expect(problems(statusChangeSchema, { status: "quoted", quoteAmount })).toEqual(["quoteAmount: quoteAmount must be at least 1 cent."]);
  });

  it.each([12.5, 0.5, 1.0000001])("needs a whole number of cents: %j", (quoteAmount) => {
    expect(problems(statusChangeSchema, { status: "quoted", quoteAmount })).toEqual(["quoteAmount: quoteAmount must be a whole number of cents."]);
  });

  it.each(["5000", "1,250", "abc", true, null, [], {}])("needs a number: %j", (quoteAmount) => {
    expect(problems(statusChangeSchema, { status: "quoted", quoteAmount })).toEqual(["quoteAmount: quoteAmount must be a whole number of cents."]);
  });

  it("has an upper limit", () => {
    expect(problems(statusChangeSchema, { status: "quoted", quoteAmount: 10_000_000_001 })).toEqual(["quoteAmount: quoteAmount can be at most 10000000000 cents."]);
  });

  it("checks the note", () => {
    expect(problems(statusChangeSchema, { status: "rejected", quoteNote: "a".repeat(2001) })).toEqual(["quoteNote: quoteNote can be at most 2000 characters."]);
    expect(problems(statusChangeSchema, { status: "rejected", quoteNote: ["a", "b"] })).toEqual(["quoteNote: quoteNote must be text."]);
    expect(problems(statusChangeSchema, { status: "rejected", quoteNote: 5 })).toEqual(["quoteNote: quoteNote must be text."]);
  });

  it("names every field that is wrong", () => {
    expect(problems(statusChangeSchema, { status: "nope", quoteAmount: "lots", quoteNote: 7 })).toEqual([
      `status: status must be one of: ${requestStatuses.join(", ")}.`,
      "quoteAmount: quoteAmount must be a whole number of cents.",
      "quoteNote: quoteNote must be text.",
    ]);
  });

  it("refuses something that is not an object", () => {
    for (const data of [null, undefined, "quoted", 42, []]) {
      expect(problems(statusChangeSchema, data).length, String(data)).toBeGreaterThan(0);
    }
  });
});
