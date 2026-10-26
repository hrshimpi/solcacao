import { describe, expect, it } from "vitest";
import { createMongoProfileLookup, profileFrom } from "./profile.service.ts";

describe("profileFrom", () => {
  it("reads the name, the company and the email", () => {
    expect(profileFrom({ name: "Isabel Vasquez", companyName: "Hacienda Brands", email: "isabel@example.com" })).toEqual({
      name: "Isabel Vasquez",
      companyName: "Hacienda Brands",
      email: "isabel@example.com",
    });
  });

  it("puts a first and a last name together when there is no single name", () => {
    expect(profileFrom({ firstName: "Isabel", lastName: "Vasquez" }).name).toBe("Isabel Vasquez");
    expect(profileFrom({ firstName: "Isabel" }).name).toBe("Isabel");
    expect(profileFrom({ lastName: "Vasquez" }).name).toBe("Vasquez");
  });

  it("prefers a single name over a first and a last name", () => {
    expect(profileFrom({ name: "Isa", firstName: "Isabel", lastName: "Vasquez" }).name).toBe("Isa");
  });

  it("finds the company where a business profile keeps it", () => {
    expect(profileFrom({ b2bProfile: { companyName: "Hacienda Brands" } }).companyName).toBe("Hacienda Brands");
    expect(profileFrom({ company: "Hacienda Brands" }).companyName).toBe("Hacienda Brands");
    expect(profileFrom({ companyName: "First", b2bProfile: { companyName: "Second" } }).companyName).toBe("First");
  });

  it("trims, and ignores empty and wrong kinds of values", () => {
    expect(profileFrom({ name: "  Isabel  ", companyName: "   ", email: 42, b2bProfile: "text" })).toEqual({
      name: "Isabel",
      companyName: undefined,
      email: undefined,
    });
  });

  it("knows nothing about a user that is not there", () => {
    expect(profileFrom(null)).toEqual({});
    expect(profileFrom(undefined)).toEqual({});
    expect(profileFrom({})).toEqual({ name: undefined, companyName: undefined, email: undefined });
  });
});

describe("createMongoProfileLookup without a database", () => {
  it("answers with an empty profile instead of failing", async () => {
    const lookup = createMongoProfileLookup();

    expect(await lookup("64b7f0c2a1b2c3d4e5f60718")).toEqual({});
    expect(await lookup("not an id")).toEqual({});
  });
});
