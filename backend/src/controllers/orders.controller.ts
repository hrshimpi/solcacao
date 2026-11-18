// The handlers for /api/checkout and /api/orders (a signed in person, and only ever their own orders), and for
// /api/admin (the team). They read the request, call the order service and write the answer.
import type { Request, RequestHandler } from "express";
import { AppError } from "../errors/AppError.ts";
import { parseOrThrow } from "../errors/validationError.ts";
import { adminOrderListQuerySchema, orderIdSchema, orderListQuerySchema, orderStatusBodySchema, placeOrderSchema, summaryQuerySchema } from "../schemas/order.schema.ts";
import type { OrderService } from "../services/order.service.ts";

function userIdOf(req: Request): string {
  if (!req.user) throw new AppError("UNAUTHENTICATED", 401, "Please sign in to do that.");
  return req.user.id;
}

export function createOrdersController(service: OrderService) {
  // what the checkout page shows: the cart, the ways to ship, and the totals
  const summary: RequestHandler = async (req, res) => {
    const { shipping } = parseOrThrow(summaryQuerySchema, req.query);
    res.json(await service.summary(userIdOf(req), shipping, req.lang));
  };

  // 201 for an order that was made, 200 for the same cart pressed again (the order that already exists)
  const place: RequestHandler = async (req, res) => {
    const input = parseOrThrow(placeOrderSchema, req.body ?? {});
    const { order, created } = await service.place(userIdOf(req), input, req.lang);
    res.status(created ? 201 : 200).json({ order });
  };

  const list: RequestHandler = async (req, res) => {
    const page = parseOrThrow(orderListQuerySchema, req.query);
    res.json(await service.list(userIdOf(req), page, req.lang));
  };

  const get: RequestHandler = async (req, res) => {
    const id = parseOrThrow(orderIdSchema, req.params.id);
    res.json({ order: await service.get(userIdOf(req), id, req.lang) });
  };

  const cancel: RequestHandler = async (req, res) => {
    const id = parseOrThrow(orderIdSchema, req.params.id);
    res.json({ order: await service.cancelOwn(userIdOf(req), id, req.lang) });
  };

  return { summary, place, list, get, cancel };
}

export function createAdminController(service: OrderService) {
  const stats: RequestHandler = async (req, res) => {
    res.json(await service.stats(req.lang));
  };

  const listOrders: RequestHandler = async (req, res) => {
    const query = parseOrThrow(adminOrderListQuerySchema, req.query);
    res.json(await service.adminList(query, req.lang));
  };

  const getOrder: RequestHandler = async (req, res) => {
    const id = parseOrThrow(orderIdSchema, req.params.id);
    res.json({ order: await service.adminGet(id, req.lang) });
  };

  const setStatus: RequestHandler = async (req, res) => {
    const id = parseOrThrow(orderIdSchema, req.params.id);
    const { status } = parseOrThrow(orderStatusBodySchema, req.body ?? {});
    res.json({ order: await service.adminSetStatus(id, status, req.lang) });
  };

  return { stats, listOrders, getOrder, setStatus };
}
