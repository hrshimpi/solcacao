import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
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
