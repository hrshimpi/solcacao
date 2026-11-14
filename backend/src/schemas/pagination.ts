// The page and limit of a list in the address (?page=2&limit=20), with messages a person can read.
// Spread it into the query schema of every list: z.object({ ...pageFields, status: ... })
import { z } from "zod";

export const pageFields = {
  page: z.coerce.number({ error: "page must be a number." }).int("page must be a whole number.").min(1, "page starts at 1.").default(1),
  limit: z.coerce
    .number({ error: "limit must be a number." })
    .int("limit must be a whole number.")
    .min(1, "limit must be at least 1.")
    .max(100, "limit can be at most 100.")
    .default(20),
};
