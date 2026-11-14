// The key that signs cookies we hand out (the cart of a visitor). It comes from JWT_SECRET but is not the same text,
// so a signed cookie can never be used as a login token or the other way around.
import { createHmac } from "node:crypto";
import { env } from "./env.ts";

export const cookieSecret = createHmac("sha256", env.JWT_SECRET).update("solcacao cookie signing").digest("hex");
