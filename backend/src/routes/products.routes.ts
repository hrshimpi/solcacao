// /api/products   (open to everybody, the text comes in the language of the request: ?lang=es or Accept-Language)
//   GET /                the list: ?q (a part of a name or country), ?origin, ?category, ?notes (lists with commas),
//                        ?minPct, ?maxPct, ?featured, ?sort=featured|price_asc|price_desc|pct_desc|newest, ?page and ?limit
//                        (12 by default, 48 at most). Answers { items, page, limit, total }
//   GET /:slug           one product, { product }
//   GET /:slug/related   up to 4 products of the same category or origin, { items }
// /api/staff/products   (the staff key or an admin)
//   GET    /             all products, also the ones that are switched off, with both languages of every text
//   GET    /:id          one product like that
//   POST   /             makes a product, with its starting stock in "quantity"
//   PATCH  /:id          changes parts of a product (the stock is not one of them)
//   PUT    /:id/inventory  { quantity, lowStockThreshold? }
import { Router } from "express";
import { createProductsController } from "../controllers/products.controller.ts";
import { requireStaff } from "../middleware/auth.ts";
import { noStore } from "../middleware/security.ts";
import { createProductService, type ProductService } from "../services/product.service.ts";
import { createMongoProductStore } from "../services/product.store.ts";

// what a shopper sees can be kept by a cache for a short while: the cart checks the stock again on the server
const shortCache = (_req: unknown, res: { set(name: string, value: string): void }, next: () => void) => {
  res.set("Cache-Control", "public, max-age=30");
  next();
};

export function createProductsRouter({ service }: { service: ProductService }) {
  const controller = createProductsController(service);
  const router = Router();

  router.get("/", shortCache, controller.list);
  router.get("/:slug", shortCache, controller.get);
  router.get("/:slug/related", shortCache, controller.related);

  return router;
}

export function createStaffProductsRouter({ service }: { service: ProductService }) {
  const controller = createProductsController(service);
  const router = Router();

  router.use(noStore, requireStaff);
  router.get("/", controller.staffList);
  router.get("/:id", controller.staffGet);
  router.post("/", controller.create);
  router.patch("/:id", controller.update);
  router.put("/:id/inventory", controller.setInventory);

  return router;
}

export const productStore = createMongoProductStore();
export const productService = createProductService({ products: productStore });
export const productsRouter = createProductsRouter({ service: productService });
export const staffProductsRouter = createStaffProductsRouter({ service: productService });
