// /api/cart   (a signed in user has a cart, a visitor has one that goes with a signed cookie called sc_guest)
//   GET    /                  the cart: { cart: { lines, itemCount, subtotal, updatedAt } } in the language of the request.
//                             Each line says how many units it can have (available) and what is wrong with it (issue):
//                             unavailable, out_of_stock or over_stock
//   POST   /items             { kind: "product", productId, quantity? } or { kind: "sampler", productIds: [4 to 6], quantity? }.
//                             The same item again adds to the line. 409 INSUFFICIENT_STOCK says how many there can be
//   PATCH  /items/:lineId     { quantity }
//   DELETE /items/:lineId     takes a line out
//   DELETE /                  empties the cart
//   POST   /merge             a signed in user: adds the cart of the visitor (the cookie) to the cart of the user
// A request with a token that ran out is answered 401 TOKEN_EXPIRED, and is never taken for a visitor's. None of the
// answers is kept by a cache. The price of a line is never something the client sends.
import { Router } from "express";
import { env } from "../config/env.ts";
import { createCartController } from "../controllers/cart.controller.ts";
import { authIfPresent, requireAuth } from "../middleware/auth.ts";
import { noStore } from "../middleware/security.ts";
import { createCartService, type CartService } from "../services/cart.service.ts";
import { createMongoCartStore } from "../services/cart.store.ts";
import { productStore } from "./products.routes.ts";

export function createCartRouter({ service, secureCookie = env.COOKIE_SECURE }: { service: CartService; secureCookie?: boolean }) {
  const controller = createCartController(service, { secure: secureCookie });
  const router = Router();

  router.use(noStore, authIfPresent);
  router.get("/", controller.get);
  router.post("/items", controller.addItem);
  router.patch("/items/:lineId", controller.setQuantity);
  router.delete("/items/:lineId", controller.removeItem);
  router.delete("/", controller.clear);
  router.post("/merge", requireAuth, controller.merge);

  return router;
}

export const cartService = createCartService({ carts: createMongoCartStore(), products: productStore });
export const cartRouter = createCartRouter({ service: cartService });
