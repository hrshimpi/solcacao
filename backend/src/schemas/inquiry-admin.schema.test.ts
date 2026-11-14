import { describe, expect, it } from "vitest";
import { inquiryIdSchema, inquiryListQuerySchema, inquiryStatusBodySchema } from "./inquiry-admin.schema.ts";

function problems(schema: { safeParse(data: unknown): { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } }, data: unknown) {
  const result = schema.safeParse(data);
  return result.success ? [] : result.error!.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
}

describe("list query", () => {
  it("has defaults: page 1, 20 per page, no filters", () => {
    expect(inquiryListQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
  });

  it("reads numbers that arrive as text, like a query string sends them", () => {
    expect(inquiryListQuerySchema.parse({ page: "3", limit: "50", status: "responded", category: "wholesale" })).toEqual({
      page: 3,
      limit: 50,
      status: "responded",
      category: "wholesale",
    });
  });

  it.each(["new", "responded"])("accepts the status %s", (status) => {
    expect(problems(inquiryListQuerySchema, { status })).toEqual([]);
  });

  it.each(["general", "wholesale", "support", "feedback", "newsletter"])("accepts the category %s", (category) => {
    expect(problems(inquiryListQuerySchema, { category })).toEqual([]);
  });

  it("explains a wrong status or category", () => {
    expect(problems(inquiryListQuerySchema, { status: "done" })).toEqual(["status: Status must be new or responded."]);
    expect(problems(inquiryListQuerySchema, { category: "complaint" })).toEqual([
      "category: category must be one of: general, wholesale, support, feedback, newsletter.",
    ]);
  });

  it("explains a wrong page or limit", () => {
    expect(problems(inquiryListQuerySchema, { page: "0" })).toEqual(["page: page starts at 1."]);
    expect(problems(inquiryListQuerySchema, { page: "-2" })).toEqual(["page: page starts at 1."]);
    expect(problems(inquiryListQuerySchema, { page: "1.5" })).toEqual(["page: page must be a whole number."]);
    expect(problems(inquiryListQuerySchema, { page: "abc" })).toEqual(["page: page must be a number."]);
    expect(problems(inquiryListQuerySchema, { limit: "0" })).toEqual(["limit: limit must be at least 1."]);
    expect(problems(inquiryListQuerySchema, { limit: "101" })).toEqual(["limit: limit can be at most 100."]);
    expect(problems(inquiryListQuerySchema, { limit: "100" })).toEqual([]);
  });

  it("ignores filters it does not know", () => {
    expect(inquiryListQuerySchema.parse({ sort: "oldest", $where: "1" })).toEqual({ page: 1, limit: 20 });
  });
});

describe("id", () => {
  it("accepts a 24 character hex id", () => {
    expect(problems(inquiryIdSchema, "64b7f0c2a1b2c3d4e5f60718")).toEqual([]);
    expect(problems(inquiryIdSchema, "64B7F0C2A1B2C3D4E5F60718")).toEqual([]);
  });

  it.each(["", "123", "not-an-id", "64b7f0c2a1b2c3d4e5f6071", "64b7f0c2a1b2c3d4e5f607189", "64b7f0c2a1b2c3d4e5f6071g", "../etc/passwd", "{}"])("refuses %j", (id) => {
    expect(problems(inquiryIdSchema, id)).toEqual([": That isn't a valid inquiry id."]);
  });
});

describe("status body", () => {
  it.each(["new", "responded"])("accepts %s", (status) => {
    expect(inquiryStatusBodySchema.parse({ status })).toEqual({ status });
  });

  it("explains anything else", () => {
    for (const body of [{ status: "closed" }, { status: "" }, { status: 1 }, {}, { status: null }]) {
      expect(problems(inquiryStatusBodySchema, body), JSON.stringify(body)).toEqual(["status: Status must be new or responded."]);
    }
  });

  it("drops other fields, so nothing else can be changed through it", () => {
    expect(inquiryStatusBodySchema.parse({ status: "responded", message: "changed", rating: 1 })).toEqual({ status: "responded" });
  });
});
