import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.url().default("http://localhost:5173"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  // brand asset uploads: a private folder (never served as static files), the size of one file in MB, and files per request
  UPLOAD_DIR: z.string().min(1).default("./uploads"),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(50),
  MAX_UPLOAD_FILES: z.coerce.number().int().positive().default(5),
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
