// Makes an admin account:
//   ADMIN_PASSWORD='a long password 1' pnpm create-admin you@example.com "Your Name"
// The password comes from the environment and not from the command, so it does not end up in the history of the shell.
import { connectDb, disconnectDb } from "../config/db.ts";
import { env } from "../config/env.ts";
import { createAdminAccount } from "../services/admin.service.ts";
import { hasher } from "../services/password.ts";
import { createMongoUserStore } from "../services/user.store.ts";

const [email, name] = process.argv.slice(2);
const password = process.env.ADMIN_PASSWORD;

if (!email || !name || !password) {
  console.error('Use: ADMIN_PASSWORD="a long password 1" pnpm create-admin you@example.com "Your Name"');
  process.exit(1);
}

try {
  await connectDb(env.MONGODB_URI);
  const admin = await createAdminAccount({ email, name, password }, { users: createMongoUserStore(), hasher });
  console.log(`Made the admin ${admin.email} (${admin.id}).`);
} catch (error) {
  const problem = error as { message?: string; details?: { message: string }[] };
  console.error(`Could not make the admin: ${problem.details?.map((detail) => detail.message).join(" ") || problem.message}`);
  process.exitCode = 1;
} finally {
  await disconnectDb();
}
