// /api/checkout and /api/orders   (a signed in person, who only ever sees their own orders)
//   GET    /api/checkout            ?shipping=standard|express: { cart, shippingOptions, shipping, totals, ready }. What the checkout
//                                   page shows: the cart as the server holds it, what each way to ship costs, and the total
//   POST   /api/orders              { addressId, shippingMethod, payment: { cardNumber, expiry, cvc, nameOnCard }, note? }: makes the order
//                                   from the cart of the person, takes the stock, charges the card (made up, see payment.service.ts) and
//                                   empties the cart. 201 { order }. The same cart pressed twice answers 200 with the same order.
//                                   400 CART_EMPTY, 409 CART_CHANGED or INSUFFICIENT_STOCK, 402 CARD_DECLINED or INSUFFICIENT_FUNDS
//   GET    /api/orders              the orders of the person, newest first: { items, page, limit, total }
//   GET    /api/orders/:id          one order (404 for an order of somebody else, the same as one that does not exist)
//   POST   /api/orders/:id/cancel   cancels an order that nobody started to pack: the stock goes back and the payment is given back
// Everything the page sends about money is ignored: the prices come from the cart and the shipping from pricing.ts.
// No answer is kept by a cache, and placing orders has a limit for each person.
import { Router, type RequestHandler } from "express";
import { ipKeyGenerator } from "express-rate-limit";
import { createOrdersController } from "../controllers/orders.controller.ts";
import { requireAuth } from "../middleware/auth.ts";
import { createRateLimiter } from "../middleware/rateLimit.ts";
import { noStore } from "../middleware/security.ts";
import { createMongoAddressStore } from "../services/address.store.ts";
import { createMongoCartStore } from "../services/cart.store.ts";
import * as mail from "../services/mail.service.ts";
import { createMongoOrderStore } from "../services/order.store.ts";
import { createOrderService, type OrderService } from "../services/order.service.ts";
import { createDemoGateway } from "../services/payment.service.ts";
import { createMongoUserStore } from "../services/user.store.ts";
import { cartService } from "./cart.routes.ts";
import { productStore } from "./products.routes.ts";

export function createOrdersRouter({ service, limiter }: { service: OrderService; limiter: RequestHandler }) {
  const controller = createOrdersController(service);
  const router = Router();

  // only the paths of this router are guarded: the router is mounted at /api, next to the others
  router.get("/checkout", noStore, requireAuth, controller.summary);
  router.post("/orders", noStore, requireAuth, limiter, controller.place);
  router.get("/orders", noStore, requireAuth, controller.list);
  router.get("/orders/:id", noStore, requireAuth, controller.get);
  router.post("/orders/:id/cancel", noStore, requireAuth, limiter, controller.cancel);

  return router;
}

// 20 tries in 15 minutes for each person is plenty for a shopper. A try that fails counts too (a card that is declined), so
// the route cannot be used to test a list of card numbers.
export const ordersLimiter = (options: { limit?: number; windowMs?: number } = {}) =>
  createRateLimiter({
    limit: options.limit ?? 20,
    windowMs: options.windowMs ?? 15 * 60 * 1000,
    message: "You are placing a lot of orders. Please try again in a few minutes.",
    keyBy: (req) => (req.user ? `user:${req.user.id}` : ipKeyGenerator(req.ip ?? "")),
    countFailedRequests: true,
  });

export const orderService = createOrderService({
  orders: createMongoOrderStore(),
  carts: createMongoCartStore(),
  cart: cartService,
  products: productStore,
  addresses: createMongoAddressStore(),
  users: createMongoUserStore(),
  gateway: createDemoGateway(),
  mail,
});

export const ordersRouter = createOrdersRouter({ service: orderService, limiter: ordersLimiter() });
