// /api/admin   (admins only, with their access token: no staff key here, because these answers show customers)
//   GET    /stats           the numbers of the dashboard: orders, revenue, orders by status, today, customers, products that are
//                           low on stock and the latest orders
//   GET    /orders          ?status=&q=&page=&limit=: every order, newest first. q is a part of the number, the email or the name
//   GET    /orders/:id      one order, with the customer
//   PATCH  /orders/:id      { status }: moves the order along (see order-status.ts). 400 INVALID_TRANSITION for a step that is not
//                           allowed, 409 ORDER_CHANGED when somebody else moved it first. Cancelling puts the stock back.
// The products, their stock, the inquiries and the quote requests of the team have their own routes (/api/staff/products,
// /api/inquiries and /api/b2b/requests), which the dashboard uses as they are.
import { Router } from "express";
import { createAdminController } from "../controllers/orders.controller.ts";
import { requireAdmin } from "../middleware/auth.ts";
import { noStore } from "../middleware/security.ts";
import type { OrderService } from "../services/order.service.ts";
import { orderService } from "./orders.routes.ts";

export function createAdminRouter({ service }: { service: OrderService }) {
  const controller = createAdminController(service);
  const router = Router();

  router.use(noStore, requireAdmin);
  router.get("/stats", controller.stats);
  router.get("/orders", controller.listOrders);
  router.get("/orders/:id", controller.getOrder);
  router.patch("/orders/:id", controller.setStatus);

  return router;
}

export const adminRouter = createAdminRouter({ service: orderService });
