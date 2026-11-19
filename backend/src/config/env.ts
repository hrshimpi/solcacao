import "dotenv/config";
import { z } from "zod";

// only for development and tests, the server refuses to start in production with this one
const devSecret = "dev-only-secret-change-me";

// a list like "https://a.example, https://b.example" becomes the addresses without a closing slash
const originList = z
  .string()
  .min(1)
  .default("http://localhost:5173")
  .transform((value) => value.split(",").map((origin) => origin.trim().replace(/\/+$/, "")).filter(Boolean))
  .pipe(z.array(z.url()).min(1, "give at least one address"));

// CLIENT_URL is the name used in the deploy notes, the older name CLIENT_ORIGIN still works
const clientAddresses = process.env.CLIENT_URL ?? process.env.CLIENT_ORIGIN;

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  // the database, and the secret that signs and checks login tokens. Left out, development uses the MongoDB on this computer,
  // production has to have its own (the refine below). A URI without a database name gets "solcacao" (see config/db.ts).
  MONGODB_URI: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(16, "use at least 16 characters").default(devSecret),
  // the address of the website. A comma separated list is fine for a site with more than one address, the first one
  // is the main one (it is used in emails). Only these addresses may send changes from a browser (CORS and the origin check).
  CLIENT_ORIGIN: originList,
  // how many proxies sit between the internet and this server (a host's load balancer counts as one). With 0 the
  // address of every visitor is the one of the proxy, and the limits on requests would count everybody together.
  // Left out, it is 1 in production (Nginx is in front) and 0 otherwise.
  TRUST_PROXY: z.coerce.number().int().min(0).optional(),
  // login tokens: the short one that is sent with every request, and the long one that gets a new short one
  ACCESS_TOKEN_MINUTES: z.coerce.number().int().min(1).max(120).default(15),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  // the work factor of password hashing. Left out, it is 12 (and 4 in tests, so they stay fast)
  BCRYPT_COST: z.coerce.number().int().min(4).max(15).optional(),
  // the cookie with the long token only travels over https when this is true. Left out, it is true in production.
  COOKIE_SECURE: z.stringbool().optional(),
  // a key for the team's own tools (sent as X-Staff-Key). Empty means no key works, admins can still sign in.
  STAFF_API_KEY: z.string().default(""),
  // how many requests one visitor may send in a window, for the whole API and for the sign in routes
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(600),
  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  // email: smtp sends with the SMTP settings below, off only logs one line. Left out, it is off in production and smtp otherwise.
  // With SMTP_HOST empty (development and tests) nothing is sent either, the message is only logged.
  MAIL_MODE: z.enum(["smtp", "off"]).optional(),
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  MAIL_FROM: z.string().min(1).default("SolCacao <no-reply@solcacao.example>"),
  MAIL_TO_SUPPORT: z.string().min(1).default("support@solcacao.example"),
  MAIL_TO_WHOLESALE: z.string().min(1).default("wholesale@solcacao.example"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  // brand asset uploads: a private folder (never served as static files), the size of one file in MB, and files per request
  UPLOAD_DIR: z.string().min(1).default("./uploads"),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(50),
  MAX_UPLOAD_FILES: z.coerce.number().int().positive().default(5),
}).refine((settings) => settings.NODE_ENV !== "production" || settings.MONGODB_URI !== undefined, {
  path: ["MONGODB_URI"],
  message: "set MONGODB_URI in production (the connection string of the database)",
}).refine((settings) => settings.NODE_ENV !== "production" || clientAddresses !== undefined, {
  path: ["CLIENT_URL"],
  message: "set CLIENT_URL in production (the address of the website, for example the Amplify address)",
}).refine((settings) => settings.SMTP_PORT !== 25, {
  path: ["SMTP_PORT"],
  message: "port 25 is blocked on AWS, use 587 or 465",
}).refine((settings) => settings.NODE_ENV !== "production" || settings.JWT_SECRET !== devSecret, {
  path: ["JWT_SECRET"],
  message: "set your own JWT_SECRET in production",
}).refine((settings) => settings.NODE_ENV !== "production" || settings.JWT_SECRET.length >= 32, {
  path: ["JWT_SECRET"],
  message: "use at least 32 characters for JWT_SECRET in production",
}).refine((settings) => settings.STAFF_API_KEY === "" || settings.STAFF_API_KEY.length >= 24, {
  path: ["STAFF_API_KEY"],
  message: "use at least 24 characters, or leave it empty to turn the key off",
});

const parsed = schema.safeParse({ ...process.env, CLIENT_ORIGIN: clientAddresses });

if (!parsed.success) {
  const problems = parsed.error.issues
    .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  console.error(`The server can't start, check these settings in backend/.env:\n${problems}`);
  process.exit(1);
}

const { CLIENT_ORIGIN, BCRYPT_COST, COOKIE_SECURE, MONGODB_URI, TRUST_PROXY, MAIL_MODE, ...settings } = parsed.data;
const production = settings.NODE_ENV === "production";

export const env = {
  ...settings,
  MONGODB_URI: MONGODB_URI ?? "mongodb://127.0.0.1:27017/solcacao",
  TRUST_PROXY: TRUST_PROXY ?? (production ? 1 : 0),
  MAIL_MODE: MAIL_MODE ?? (production ? "off" : "smtp"),
  // the local development page may also talk to the API, but never in production
  CLIENT_ORIGINS: production || CLIENT_ORIGIN.includes("http://localhost:5173") ? CLIENT_ORIGIN : [...CLIENT_ORIGIN, "http://localhost:5173"],
  // the main address of the website
  SITE_URL: CLIENT_ORIGIN[0],
  BCRYPT_COST: BCRYPT_COST ?? (settings.NODE_ENV === "test" ? 4 : 12),
  COOKIE_SECURE: COOKIE_SECURE ?? settings.NODE_ENV === "production",
};
