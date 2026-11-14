// Loads the seven products of the shop with their stock:
//   pnpm seed
// It is safe to run again: a product is found by its slug and gets its text back as it is in the seed, and the stock
// numbers of products that already exist are never touched.
import { connectDb, disconnectDb } from "../config/db.ts";
import { env } from "../config/env.ts";
import { Inventory } from "../models/inventory.model.ts";
import { Product } from "../models/product.model.ts";
import { seedProducts } from "../seed/products.seed.ts";
import { createMongoProductStore } from "../services/product.store.ts";

try {
  await connectDb(env.MONGODB_URI);
  // the unique indexes have to be there before the first product is saved
  await Promise.all([Product.init(), Inventory.init()]);

  const store = createMongoProductStore();
  for (const { product, quantity } of seedProducts) {
    console.log(`${await store.upsertBySlug(product, quantity)}: ${product.slug}`);
  }
} catch (error) {
  console.error(`The seed failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await disconnectDb();
}
