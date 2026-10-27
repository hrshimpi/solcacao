import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { Inquiry, inquiryCategories, inquiryStatuses } from "./inquiry.model.ts";

// These tests only build documents and run validation, so they do not need a database.

const general = {
  category: "general",
  name: "Isabel Vasquez",
  email: "isabel@example.com",
  message: "Do you ship the Ecuador bar to Canada?",
};

// returns the names of the fields that failed validation (an empty list means the inquiry is valid)
async function errorPaths(data: Record<string, unknown>) {
  try {
    await new Inquiry(data).validate();
    return [];
  } catch (error) {
    return Object.keys((error as mongoose.Error.ValidationError).errors);
  }
}

describe("Inquiry defaults", () => {
  it("starts as new, with no user", async () => {
    const inquiry = new Inquiry(general);

    await expect(inquiry.validate()).resolves.toBeUndefined();
    expect(inquiry.status).toBe("new");
    expect(inquiry.userId).toBeUndefined();
    expect(inquiry.rating).toBeUndefined();
  });

  it("can belong to a signed in user", async () => {
    const userId = new mongoose.Types.ObjectId();
    const inquiry = new Inquiry({ ...general, userId });

    await expect(inquiry.validate()).resolves.toBeUndefined();
    expect(String(inquiry.userId)).toBe(String(userId));
  });

  it("trims the text and writes the email in lower case", () => {
    const inquiry = new Inquiry({ ...general, name: "  Isabel  ", email: "  Isabel@Example.COM " });

    expect(inquiry.name).toBe("Isabel");
    expect(inquiry.email).toBe("isabel@example.com");
  });
});

describe("Inquiry category", () => {
  it("knows the five categories", () => {
    expect(inquiryCategories).toEqual(["general", "wholesale", "support", "feedback", "newsletter"]);
  });

  it.each(["general", "wholesale", "support"])("accepts a %s inquiry", async (category) => {
    expect(await errorPaths({ ...general, category })).toEqual([]);
  });

  it("accepts feedback with only a rating", async () => {
    expect(await errorPaths({ category: "feedback", rating: 5 })).toEqual([]);
  });

  it("accepts a newsletter sign up with only an email", async () => {
    expect(await errorPaths({ category: "newsletter", email: "isabel@example.com" })).toEqual([]);
  });

  it("is required and must be one of the five", async () => {
    expect(await errorPaths({ ...general, category: undefined })).toContain("category");
    expect(await errorPaths({ ...general, category: "complaint" })).toContain("category");
  });
});

describe("Inquiry required fields depend on the category", () => {
  it.each(["general", "wholesale", "support"])("%s needs a name, an email and a message", async (category) => {
    expect((await errorPaths({ category })).sort()).toEqual(["email", "message", "name"]);
  });

  it("feedback needs a rating and nothing else", async () => {
    expect(await errorPaths({ category: "feedback" })).toEqual(["rating"]);
  });

  it("newsletter needs an email and nothing else", async () => {
    expect(await errorPaths({ category: "newsletter" })).toEqual(["email"]);
  });

  it("checks the email address", async () => {
    expect(await errorPaths({ ...general, email: "isabel" })).toContain("email");
    expect(await errorPaths({ category: "newsletter", email: "isabel@example" })).toContain("email");
  });

  it("limits the name and the message", async () => {
    expect(await errorPaths({ ...general, name: "a".repeat(81) })).toContain("name");
    expect(await errorPaths({ ...general, message: "a".repeat(2001) })).toContain("message");
    expect(await errorPaths({ ...general, message: "a".repeat(2000) })).toEqual([]);
  });
});

describe("Inquiry rating", () => {
  it.each([1, 2, 3, 4, 5])("accepts %i for feedback", async (rating) => {
    expect(await errorPaths({ category: "feedback", rating })).toEqual([]);
  });

  it.each([0, 6, -1, 2.5])("rejects %s", async (rating) => {
    expect(await errorPaths({ category: "feedback", rating })).toContain("rating");
  });

  it("is only for feedback", async () => {
    expect(await errorPaths({ ...general, rating: 5 })).toEqual(["rating"]);
    expect(await errorPaths({ category: "newsletter", email: "isabel@example.com", rating: 3 })).toEqual(["rating"]);
  });
});

describe("Inquiry status", () => {
  it("only accepts new and responded", async () => {
    expect(inquiryStatuses).toEqual(["new", "responded"]);
    expect(await errorPaths({ ...general, status: "responded" })).toEqual([]);
    expect(await errorPaths({ ...general, status: "closed" })).toContain("status");
  });
});

describe("Inquiry schema", () => {
  it("points userId at the User model", () => {
    expect(Inquiry.schema.path("userId").options.ref).toBe("User");
  });

  it("has an index on status and createdAt (newest first)", () => {
    const indexes = Inquiry.schema.indexes().map(([fields]) => fields);

    expect(indexes).toContainEqual({ status: 1, createdAt: -1 });
  });

  it("keeps createdAt but has no updatedAt", () => {
    expect(Inquiry.schema.path("createdAt")).toBeDefined();
    expect(Inquiry.schema.path("updatedAt")).toBeUndefined();
  });

  it("returns id instead of _id and __v when turned into JSON", () => {
    const inquiry = new Inquiry(general);
    const json = inquiry.toJSON();

    expect(json).toHaveProperty("id", String(inquiry._id));
    expect(json).not.toHaveProperty("_id");
    expect(json).not.toHaveProperty("__v");
  });
});
