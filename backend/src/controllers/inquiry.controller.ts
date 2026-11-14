// The handlers for /api/inquiries. They read the request, call the service and write the answer.
import { randomBytes } from "node:crypto";
import type { Request, RequestHandler } from "express";
import { parseOrThrow } from "../errors/validationError.ts";
import { inquiryIdSchema, inquiryListQuerySchema, inquiryStatusBodySchema } from "../schemas/inquiry-admin.schema.ts";
import { inquirySchema } from "../schemas/inquiry.schema.ts";
import type { InquiryService } from "../services/inquiry.service.ts";

// Spanish when the browser asks for it first, English otherwise
function languageOf(req: Request): "en" | "es" {
  const first = (req.headers["accept-language"] ?? "").split(",")[0].trim().toLowerCase();
  return first.startsWith("es") ? "es" : "en";
}

// A real visitor never sees the hidden "website" field, so anything in it means a bot filled in the form.
function filledHoneypot(body: unknown): boolean {
  if (typeof body !== "object" || body === null || !("website" in body)) return false;
  return body.website !== undefined && body.website !== "";
}

// a made up id that looks like a real one, for the answer a bot gets
function fakeId(): string {
  return randomBytes(12).toString("hex");
}

// the user id from the token, when it is an id we could have saved
function userIdOf(req: Request): string | undefined {
  return req.user && /^[0-9a-f]{24}$/i.test(req.user.id) ? req.user.id : undefined;
}

export function createInquiryController(service: InquiryService) {
  const create: RequestHandler = async (req, res) => {
    // A bot gets the answer of a success, and nothing is saved or emailed, so it does not learn that it was spotted.
    if (filledHoneypot(req.body)) {
      res.status(201).json({ id: fakeId() });
      return;
    }

    const input = parseOrThrow(inquirySchema, req.body);
    const { id } = await service.submit(input, { userId: userIdOf(req), lang: languageOf(req) });
    res.status(201).json({ id });
  };

  const list: RequestHandler = async (req, res) => {
    const query = parseOrThrow(inquiryListQuerySchema, req.query);
    res.json(await service.list(query));
  };

  const update: RequestHandler = async (req, res) => {
    const id = parseOrThrow(inquiryIdSchema, req.params.id);
    const { status } = parseOrThrow(inquiryStatusBodySchema, req.body);
    res.json(await service.setStatus(id, status));
  };

  return { create, list, update };
}
