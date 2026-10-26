// The handlers for /api/b2b. A quote request arrives as a multipart form: the upload middleware has already
// checked and stored the files and put the text fields in req.body by the time this runs.
// The rest read and change the requests that were sent: the list, one request, one of its files and the status.
import { pipeline } from "node:stream/promises";
import type { Request, RequestHandler } from "express";
import { AppError } from "../errors/AppError.ts";
import { parseOrThrow } from "../errors/validationError.ts";
import type { AuthUser } from "../middleware/auth.ts";
import { uploadsFrom } from "../middleware/upload.ts";
import { requestIdSchema, requestListQuerySchema, statusChangeSchema } from "../schemas/b2b-requests.schema.ts";
import { quoteRequestSchema } from "../schemas/b2b.schema.ts";
import type { B2BService } from "../services/b2b.service.ts";
import type { UserProfile } from "../services/profile.service.ts";

// the signed in user, when the id in the token is one we could have saved. The routes check the token before this runs.
function signedInUser(req: Request): AuthUser {
  const user = req.user;
  if (!user || !/^[0-9a-f]{24}$/i.test(user.id)) throw new AppError("UNAUTHENTICATED", 401, "Please sign in again to do that.");
  return user;
}

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
    const uploads = uploadsFrom(res);

    try {
      const user = signedInUser(req);
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

  const list: RequestHandler = async (req, res) => {
    const user = signedInUser(req);
    const query = parseOrThrow(requestListQuerySchema, req.query);
    res.json(await service.listFor(user.id, query));
  };

  const get: RequestHandler = async (req, res) => {
    const user = signedInUser(req);
    const id = parseOrThrow(requestIdSchema, req.params.id);
    res.json({ request: await service.get(id, user) });
  };

  // The only place where a stored file leaves the server, and only for the owner of the request or an admin.
  // It is sent as a download with the name the person gave it, never inline, and never kept by a cache.
  const downloadAsset: RequestHandler = async (req, res) => {
    const user = signedInUser(req);
    const id = parseOrThrow(requestIdSchema, req.params.id);
    const { asset, content } = await service.openAsset(id, String(req.params.storedName), user);

    res.attachment(asset.originalName);
    // the type that was checked when the file came in, without any extra parameters
    res.type(asset.mimeType.split(";")[0].trim());
    res.set({ "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" });

    try {
      await pipeline(content, res);
    } catch (error) {
      // the download already started, or the person left: there is nobody to send an error to
      if (res.headersSent || res.destroyed) {
        req.log.warn({ err: error }, "a download stopped early");
        res.destroy();
        return;
      }
      // nothing was sent yet, so the error answer must not look like a file
      for (const header of ["Content-Disposition", "Content-Type", "X-Content-Type-Options", "Cache-Control"]) res.removeHeader(header);
      throw error;
    }
  };

  const updateStatus: RequestHandler = async (req, res) => {
    const id = parseOrThrow(requestIdSchema, req.params.id);
    const change = parseOrThrow(statusChangeSchema, req.body ?? {});
    res.json({ request: await service.changeStatus(id, change) });
  };

  return { createQuote, list, get, downloadAsset, updateStatus };
}
