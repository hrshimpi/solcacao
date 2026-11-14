// The handlers for /api/products (open to everybody) and /api/staff/products (the team).
import type { RequestHandler } from "express";
import { AppError } from "../errors/AppError.ts";
import { parseOrThrow } from "../errors/validationError.ts";
import { inventorySchema, productCreateSchema, productIdSchema, productListQuerySchema, productPatchSchema, slugSchema } from "../schemas/product.schema.ts";
import type { ProductService } from "../services/product.service.ts";

// an address that cannot be the slug of a product is a product that is not there, not a mistake in the request
function slugOf(value: unknown): string {
  const slug = slugSchema.safeParse(value);
  if (!slug.success) throw new AppError("NOT_FOUND", 404, "That product wasn't found.");
  return slug.data.toLowerCase();
}

export function createProductsController(service: ProductService) {
  const list: RequestHandler = async (req, res) => {
    const query = parseOrThrow(productListQuerySchema, req.query);
    res.json(await service.list(query, req.lang));
  };

  const get: RequestHandler = async (req, res) => {
    res.json({ product: await service.get(slugOf(req.params.slug), req.lang) });
  };

  const related: RequestHandler = async (req, res) => {
    res.json({ items: await service.related(slugOf(req.params.slug), req.lang) });
  };

  const staffList: RequestHandler = async (req, res) => {
    const query = parseOrThrow(productListQuerySchema, req.query);
    res.json(await service.staffList(query));
  };

  const staffGet: RequestHandler = async (req, res) => {
    res.json({ product: await service.staffGet(parseOrThrow(productIdSchema, req.params.id)) });
  };

  const create: RequestHandler = async (req, res) => {
    const input = parseOrThrow(productCreateSchema, req.body ?? {});
    res.status(201).json({ product: await service.create(input) });
  };

  const update: RequestHandler = async (req, res) => {
    const id = parseOrThrow(productIdSchema, req.params.id);
    const patch = parseOrThrow(productPatchSchema, req.body ?? {});
    res.json({ product: await service.update(id, patch) });
  };

  const setInventory: RequestHandler = async (req, res) => {
    const id = parseOrThrow(productIdSchema, req.params.id);
    const stock = parseOrThrow(inventorySchema, req.body ?? {});
    res.json({ product: await service.setInventory(id, stock) });
  };

  return { list, get, related, staffList, staffGet, create, update, setInventory };
}
