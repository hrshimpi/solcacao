// The handlers for /api/b2b. A quote request arrives as a multipart form: the upload middleware has already
// checked and stored the files and put the text fields in req.body by the time this runs.
import type { RequestHandler } from "express";
import { AppError } from "../errors/AppError.ts";
import { parseOrThrow } from "../errors/validationError.ts";
import { uploadsFrom } from "../middleware/upload.ts";
import { quoteRequestSchema } from "../schemas/b2b.schema.ts";
import type { B2BService } from "../services/b2b.service.ts";
import type { UserProfile } from "../services/profile.service.ts";

// the company and contact name come from the user's profile when the form did not have them (or had them empty)
function withProfileDefaults(body: unknown, profile: UserProfile): Record<string, unknown> {
  const fields: Record<string, unknown> = typeof body === "object" && body !== null ? { ...body } : {};
  const isMissing = (value: unknown) => typeof value !== "string" || value.trim() === "";

  if (isMissing(fields.companyName)) fields.companyName = profile.companyName;
  if (isMissing(fields.contactName)) fields.contactName = profile.name;
  return fields;
}

export function createB2BController(service: B2BService) {
  const createQuote: RequestHandler = async (req, res) => {
    const user = req.user;
    const uploads = uploadsFrom(res);

    try {
      // the routes only let signed in business accounts get here, this is for the token with an id we cannot save
      if (!user || !/^[0-9a-f]{24}$/i.test(user.id)) throw new AppError("UNAUTHENTICATED", 401, "Please sign in again to do that.");

      const profile = await service.profileOf(user.id);
      const input = parseOrThrow(quoteRequestSchema, withProfileDefaults(req.body, profile));
      const request = await service.createQuote(input, uploads, { id: user.id, profile });
      res.status(201).json({ request });
    } catch (error) {
      // anything that goes wrong after the files were stored takes the files away again
      await service.discardUploads(uploads);
      throw error;
    }
  };

  return { createQuote };
}
