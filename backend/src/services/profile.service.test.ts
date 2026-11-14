import { describe, expect, it } from "vitest";
import { createMemoryB2BProfileStore } from "../test/memoryB2BProfileStore.ts";
import { createMemoryUserStore } from "../test/memoryUserStore.ts";
import { createMongoProfileLookup, createProfileLookup } from "./profile.service.ts";

async function setup() {
  const users = createMemoryUserStore();
  const profiles = createMemoryB2BProfileStore();
  const business = await users.create({ email: "isabel@hacienda.example", name: "Isabel Vasquez", passwordHash: "x", accountType: "b2b", preferredLanguage: "en" });
  await profiles.save(business.id, { companyName: "Hacienda Brands" });
  const retail = await users.create({ email: "marco@example.com", name: "Marco", passwordHash: "x", accountType: "retail", preferredLanguage: "es" });
  return { lookup: createProfileLookup({ users, profiles }), business, retail };
}

describe("createProfileLookup", () => {
  it("knows the name, the email and the company of a business account", async () => {
    const { lookup, business } = await setup();

    expect(await lookup(business.id)).toEqual({ email: "isabel@hacienda.example", name: "Isabel Vasquez", companyName: "Hacienda Brands" });
  });

  it("knows no company for a retail account", async () => {
    const { lookup, retail } = await setup();

    expect(await lookup(retail.id)).toEqual({ email: "marco@example.com", name: "Marco", companyName: undefined });
  });

  it("knows nothing about a user that is not there", async () => {
    const { lookup } = await setup();

    expect(await lookup("64b7f0c2a1b2c3d4e5f60718")).toEqual({ email: undefined, name: undefined, companyName: undefined });
  });

  it("answers with an empty profile instead of failing when a store fails", async () => {
    const broken = createProfileLookup({
      users: { ...createMemoryUserStore(), findById: async () => Promise.reject(new Error("database is down")) },
      profiles: createMemoryB2BProfileStore(),
    });

    expect(await broken("64b7f0c2a1b2c3d4e5f60718")).toEqual({});
  });
});

describe("createMongoProfileLookup without a database", () => {
  it("answers with an empty profile instead of failing", async () => {
    const lookup = createMongoProfileLookup();

    expect(await lookup("64b7f0c2a1b2c3d4e5f60718")).toEqual({});
    expect(await lookup("not an id")).toEqual({});
  });
});
