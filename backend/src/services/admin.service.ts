// Makes an admin account. The sign up route can only make people and businesses, so the first admin (and any later
// one) comes from the command in scripts/create-admin.ts, which runs on the machine of whoever runs the server.
import { z } from "zod";
import { emailField, nameField, passwordField } from "../schemas/auth.schema.ts";
import { validationError } from "../errors/validationError.ts";
import type { Hasher } from "./password.ts";
import type { StoredUser, UserStore } from "./user.store.ts";

const adminSchema = z.object({ email: emailField, name: nameField, password: passwordField });

// the same rules as for any account: a good password, an email nobody has used
export async function createAdminAccount(input: unknown, { users, hasher }: { users: UserStore; hasher: Hasher }): Promise<StoredUser> {
  const parsed = adminSchema.safeParse(input);
  if (!parsed.success) throw validationError(parsed.error);

  const { email, name, password } = parsed.data;
  return users.create({ email, name, passwordHash: await hasher.hash(password), accountType: "retail", preferredLanguage: "en", role: "admin" });
}
