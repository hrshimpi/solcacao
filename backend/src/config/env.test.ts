// Checks the rules of config/env.ts and config/db.ts that matter when the API runs in production.
import { afterEach, describe, expect, it, vi } from "vitest";
import { hasDatabaseName } from "./db.ts";

const production = {
  NODE_ENV: "production",
  MONGODB_URI: "mongodb+srv://user:pass@cluster.example.mongodb.net/solcacao",
  JWT_SECRET: "a".repeat(40),
  CLIENT_URL: "https://app.example.com/",
};

// loads env.ts fresh with exactly these variables (the others are removed), the .env file is not read
async function load(variables: Record<string, string>) {
  vi.resetModules();
  vi.doMock("dotenv/config", () => ({}));
  for (const key of ["NODE_ENV", "MONGODB_URI", "JWT_SECRET", "CLIENT_URL", "CLIENT_ORIGIN", "TRUST_PROXY", "MAIL_MODE", "SMTP_PORT"]) vi.stubEnv(key, undefined);
  for (const [key, value] of Object.entries(variables)) vi.stubEnv(key, value);
  return import("./env.ts");
}

// the message env.ts prints before it stops
async function refused(variables: Record<string, string>) {
  vi.restoreAllMocks();
  const exit = vi.spyOn(process, "exit").mockImplementation((() => {
    throw new Error("exit");
  }) as never);
  const print = vi.spyOn(console, "error").mockImplementation(() => {});
  await expect(load(variables)).rejects.toThrow("exit");
  expect(exit).toHaveBeenCalledWith(1);
  return String(print.mock.calls[0][0]);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("env in production", () => {
  it("takes the website address from CLIENT_URL, without the closing slash, and never allows localhost", async () => {
    const { env } = await load(production);

    expect(env.CLIENT_ORIGINS).toEqual(["https://app.example.com"]);
    expect(env.SITE_URL).toBe("https://app.example.com");
  });

  it("trusts one proxy and has email off, unless they are set", async () => {
    const { env } = await load(production);
    expect(env.TRUST_PROXY).toBe(1);
    expect(env.MAIL_MODE).toBe("off");

    const set = (await load({ ...production, TRUST_PROXY: "2", MAIL_MODE: "smtp" })).env;
    expect(set.TRUST_PROXY).toBe(2);
    expect(set.MAIL_MODE).toBe("smtp");
  });

  it("does not start without MONGODB_URI, and names the variable", async () => {
    const { MONGODB_URI, ...rest } = production;
    const message = await refused(rest);

    expect(message).toContain("MONGODB_URI");
    expect(message).not.toContain(MONGODB_URI);
  });

  it("does not start without JWT_SECRET or without CLIENT_URL", async () => {
    const { JWT_SECRET, ...withoutSecret } = production;
    expect(await refused(withoutSecret)).toContain("JWT_SECRET");

    const { CLIENT_URL, ...withoutAddress } = production;
    expect(await refused(withoutAddress)).toContain("CLIENT_URL");
  });

  it("does not start with port 25 for email", async () => {
    expect(await refused({ ...production, SMTP_PORT: "25" })).toContain("SMTP_PORT");
  });
});

describe("env in development", () => {
  it("uses the local database and the local page, and still takes CLIENT_URL", async () => {
    const { env } = await load({ NODE_ENV: "development", CLIENT_URL: "https://app.example.com" });

    expect(env.MONGODB_URI).toBe("mongodb://127.0.0.1:27017/solcacao");
    expect(env.CLIENT_ORIGINS).toEqual(["https://app.example.com", "http://localhost:5173"]);
    expect(env.TRUST_PROXY).toBe(0);
    expect(env.MAIL_MODE).toBe("smtp");
  });

  it("still reads the older name CLIENT_ORIGIN", async () => {
    const { env } = await load({ NODE_ENV: "development", CLIENT_ORIGIN: "https://old.example.com" });

    expect(env.CLIENT_ORIGINS[0]).toBe("https://old.example.com");
  });
});

describe("hasDatabaseName", () => {
  it("sees a name in the address, with or without options", () => {
    expect(hasDatabaseName("mongodb://127.0.0.1:27017/solcacao")).toBe(true);
    expect(hasDatabaseName("mongodb+srv://u:p@cluster.example.net/solcacao?retryWrites=true")).toBe(true);
  });

  it("sees that there is no name", () => {
    expect(hasDatabaseName("mongodb://127.0.0.1:27017")).toBe(false);
    expect(hasDatabaseName("mongodb+srv://u:p@cluster.example.net/?retryWrites=true")).toBe(false);
    expect(hasDatabaseName("mongodb+srv://u:p@cluster.example.net")).toBe(false);
  });
});
