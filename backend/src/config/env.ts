import "dotenv/config";
import { z } from "zod";

// only for development and tests, the server refuses to start in production with this one
const devSecret = "dev-only-secret-change-me";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  // the database, and the secret that signs and checks login tokens
  MONGODB_URI: z.string().min(1).default("mongodb://127.0.0.1:27017/solcacao"),
  JWT_SECRET: z.string().min(16, "use at least 16 characters").default(devSecret),
  CLIENT_ORIGIN: z.url().default("http://localhost:5173"),
  // email: with SMTP_HOST empty (development and tests) nothing is sent, the message is only logged
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  MAIL_FROM: z.string().min(1).default("SolCacao <no-reply@solcacao.example>"),
  MAIL_TO_SUPPORT: z.string().min(1).default("support@solcacao.example"),
  MAIL_TO_WHOLESALE: z.string().min(1).default("wholesale@solcacao.example"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
}).refine((settings) => settings.NODE_ENV !== "production" || settings.JWT_SECRET !== devSecret, {
  path: ["JWT_SECRET"],
  message: "set your own JWT_SECRET in production",
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues
    .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  console.error(`The server can't start, check these settings in backend/.env:\n${problems}`);
  process.exit(1);
}

export const env = parsed.data;
