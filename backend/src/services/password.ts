// Passwords are hashed with bcrypt and only the hash is kept. bcrypt reads at most 72 bytes of a password, so
// longer passwords are refused (see the password rule in the schemas) instead of being cut off without telling anyone.
import bcrypt from "bcryptjs";
import { env } from "../config/env.ts";

export interface Hasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
  // a check that takes as long as a real one and always fails, for when there is no account to check against.
  // Without it a sign in with an unknown email would answer faster than one with a wrong password.
  verifyNothing(password: string): Promise<false>;
}

export function createHasher(cost: number): Hasher {
  // made once, the first time it is needed
  let decoy: Promise<string> | undefined;

  return {
    hash: (password) => bcrypt.hash(password, cost),
    verify: (password, hash) => bcrypt.compare(password, hash),
    async verifyNothing(password) {
      decoy ??= bcrypt.hash("this is not the password of anybody", cost);
      await bcrypt.compare(password, await decoy);
      return false;
    },
  };
}

export const hasher = createHasher(env.BCRYPT_COST);
