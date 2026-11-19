// Loads the products of the shop with their stock, and one admin when ADMIN_EMAIL and ADMIN_PASSWORD are set:
//   pnpm seed
// It is safe to run again: a product is found by its slug and gets its text back as it is in the seed, the stock
// numbers of products that already exist are never touched, and an admin that exists is left as it is.
// It only prints counts. It needs MONGODB_URI, so it never fills the database on this computer by accident.
import { connectDb, disconnectDb } from "../config/db.ts";
import { env } from "../config/env.ts";
import { Inventory } from "../models/inventory.model.ts";
import { Product } from "../models/product.model.ts";
import { seedProducts } from "../seed/products.seed.ts";
import { createAdminAccount } from "../services/admin.service.ts";
import { hasher } from "../services/password.ts";
import { createMongoProductStore } from "../services/product.store.ts";
import { createMongoUserStore } from "../services/user.store.ts";

// env.ts has already read the .env file, so this is the value the person wrote there
if (!process.env.MONGODB_URI) {
  console.error("The seed needs MONGODB_URI. Set it in backend/.env or in the environment.");
  process.exit(1);
}

try {
  await connectDb(env.MONGODB_URI);
  // the unique indexes have to be there before the first product is saved
  await Promise.all([Product.init(), Inventory.init()]);

  const store = createMongoProductStore();
  const counts = { created: 0, updated: 0 };
  for (const { product, quantity } of seedProducts) {
    counts[await store.upsertBySlug(product, quantity)] += 1;
  }
  console.log(`Products: ${counts.created} created, ${counts.updated} updated.`);

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    try {
      await createAdminAccount({ email, name: "Admin", password }, { users: createMongoUserStore(), hasher });
      console.log("Admin: 1 created.");
    } catch (error) {
      // an address that already has an account is fine, running the seed again must not fail
      if ((error as { code?: string }).code !== "EMAIL_TAKEN") throw error;
      console.log("Admin: 0 created (that email already has an account).");
    }
  } else {
    console.log("Admin: skipped (ADMIN_EMAIL and ADMIN_PASSWORD are not both set).");
  }
} catch (error) {
  console.error(`The seed failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await disconnectDb();
}
