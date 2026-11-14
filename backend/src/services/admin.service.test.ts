import { describe, expect, it } from "vitest";
import { createMemoryUserStore } from "../test/memoryUserStore.ts";
import { createAdminAccount } from "./admin.service.ts";
import { createHasher } from "./password.ts";

const hasher = createHasher(4);
const input = { email: "Boss@Example.com", name: "The Boss", password: "a long enough pass 1" };

describe("createAdminAccount", () => {
  it("makes an account with the admin role, and keeps only the hash of the password", async () => {
    const users = createMemoryUserStore();

    const admin = await createAdminAccount(input, { users, hasher });

    expect(admin).toMatchObject({ email: "boss@example.com", name: "The Boss", role: "admin" });
    const credentials = await users.findCredentialsById(admin.id);
    expect(credentials?.passwordHash).not.toContain("a long enough pass");
    expect(await hasher.verify(input.password, credentials!.passwordHash)).toBe(true);
  });

  it("holds the password and the email to the same rules as every account", async () => {
    const users = createMemoryUserStore();

    await expect(createAdminAccount({ ...input, password: "short" }, { users, hasher })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(createAdminAccount({ ...input, email: "nope" }, { users, hasher })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(users.all()).toHaveLength(0);
  });

  it("refuses an email that already has an account", async () => {
    const users = createMemoryUserStore();
    await createAdminAccount(input, { users, hasher });

    await expect(createAdminAccount(input, { users, hasher })).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
  });
});
