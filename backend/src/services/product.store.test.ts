import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Inventory } from "../models/inventory.model.ts";
import { Product } from "../models/product.model.ts";
import { seedProducts } from "../seed/products.seed.ts";
import { createMemoryProductStore } from "../test/memoryProductStore.ts";
import { createMongoProductStore, type ProductQuery, type ProductStore } from "./product.store.ts";

// an id that is valid, but that no product has
const missingId = "64b7f0c2a1b2c3d4e5f607ff";
const base: ProductQuery = { sort: "featured", page: 1, limit: 48 };
const slugs = (items: { slug: string }[]) => items.map((item) => item.slug);
const wait = () => new Promise((resolve) => setTimeout(resolve, 3));

// The same rules are checked on both stores: the one in memory (always) and the one for MongoDB
// (only when MONGODB_TEST_URI is set, see the readme). They are filled with the seven products of the shop.
function storeContract(makeStore: () => ProductStore | Promise<ProductStore>) {
  let store: ProductStore;

  beforeEach(async () => {
    store = await makeStore();
    for (const { product, quantity } of seedProducts) {
      await store.create(product, quantity);
      // so that "newest" has an order to find
      await wait();
    }
  });

  describe("list: filters", () => {
    it("lists every active product, the featured ones first and then in the order of the shop", async () => {
      const { items, total } = await store.list(base);

      expect(total).toBe(7);
      expect(slugs(items)).toEqual(["ecuador-72", "peru-68", "venezuela-76", "madagascar-80", "midnight-truffle", "colombia-64", "fleur-de-sel-bar"]);
    });

    it("gives each product its stock, and the number at which it counts as low", async () => {
      const { items } = await store.list(base);
      const byslug = Object.fromEntries(items.map((item) => [item.slug, item]));

      expect(byslug["ecuador-72"]).toMatchObject({ quantity: 120, lowStockThreshold: 10 });
      expect(byslug["venezuela-76"].quantity).toBe(6);
      expect(byslug["fleur-de-sel-bar"].quantity).toBe(0);
    });

    it("keeps both languages of every text, and the price in whole cents", async () => {
      const { items } = await store.list({ ...base, origins: ["peru"] });

      expect(items[0]).toMatchObject({ name: { en: "Peru 68%", es: "Perú 68%" }, price: 1100, originName: { en: "Peru", es: "Perú" } });
      expect(items[0].description.es).toContain("Junín");
    });

    it("filters by origin, one or several", async () => {
      expect(slugs((await store.list({ ...base, origins: ["ecuador"] })).items)).toEqual(["ecuador-72", "midnight-truffle", "fleur-de-sel-bar"]);
      expect(slugs((await store.list({ ...base, origins: ["peru", "colombia"] })).items)).toEqual(["peru-68", "colombia-64"]);
    });

    it("filters by category", async () => {
      expect(slugs((await store.list({ ...base, categories: ["truffle"] })).items)).toEqual(["midnight-truffle"]);
      expect((await store.list({ ...base, categories: ["bar"] })).total).toBe(5);
      expect((await store.list({ ...base, categories: ["truffle", "seasonal"] })).total).toBe(2);
    });

    it("filters by the cacao percentage, with both ends included", async () => {
      expect(slugs((await store.list({ ...base, minPct: 76 })).items)).toEqual(["venezuela-76", "madagascar-80"]);
      expect(slugs((await store.list({ ...base, maxPct: 64 })).items)).toEqual(["colombia-64"]);
      expect(slugs((await store.list({ ...base, minPct: 68, maxPct: 72 })).items)).toEqual(["ecuador-72", "peru-68", "midnight-truffle", "fleur-de-sel-bar"]);
    });

    it("filters by tasting notes: a product matches when it has any of them", async () => {
      expect(slugs((await store.list({ ...base, notes: ["smoky"] })).items)).toEqual(["venezuela-76", "midnight-truffle"]);
      expect(slugs((await store.list({ ...base, notes: ["smoky", "nutty"] })).items)).toEqual(["peru-68", "venezuela-76", "midnight-truffle", "colombia-64"]);
    });

    it("filters by featured, and by not featured", async () => {
      expect((await store.list({ ...base, featured: true })).total).toBe(5);
      expect(slugs((await store.list({ ...base, featured: false })).items)).toEqual(["colombia-64", "fleur-de-sel-bar"]);
    });

    it("puts the filters together", async () => {
      const found = await store.list({ ...base, origins: ["ecuador"], categories: ["bar", "seasonal"], minPct: 68, notes: ["floral"] });

      expect(slugs(found.items)).toEqual(["ecuador-72", "fleur-de-sel-bar"]);
      expect(found.total).toBe(2);
    });

    it("finds nothing, without an error, when nothing matches", async () => {
      expect(await store.list({ ...base, origins: ["peru"], categories: ["truffle"] })).toEqual({ items: [], total: 0 });
    });
  });

  describe("list: search", () => {
    it("finds a part of a name, in any case", async () => {
      expect(slugs((await store.list({ ...base, q: "ECUA" })).items)).toEqual(["ecuador-72", "midnight-truffle", "fleur-de-sel-bar"]);
      expect(slugs((await store.list({ ...base, q: "midnight" })).items)).toEqual(["midnight-truffle"]);
    });

    it("finds the name in the other language, with or without accents", async () => {
      expect(slugs((await store.list({ ...base, q: "peru" })).items)).toEqual(["peru-68"]);
      expect(slugs((await store.list({ ...base, q: "Perú" })).items)).toEqual(["peru-68"]);
      expect(slugs((await store.list({ ...base, q: "trufa" })).items)).toEqual(["midnight-truffle"]);
      expect(slugs((await store.list({ ...base, q: "flor de sal" })).items)).toEqual(["fleur-de-sel-bar"]);
    });

    it("reads what is typed as text and never as a pattern", async () => {
      for (const q of [".", ".*", "(", "[a-z]", "^", "$", "\\", "a|b", "+++", "(?=x)"]) {
        expect(await store.list({ ...base, q }), q).toEqual({ items: [], total: 0 });
      }
    });

    it("does not take an empty search for a filter", async () => {
      expect((await store.list({ ...base, q: "" })).total).toBe(7);
    });
  });

  describe("list: order and pages", () => {
    it("sorts by price, the cheapest or the dearest first", async () => {
      expect(slugs((await store.list({ ...base, sort: "price_asc" })).items)).toEqual(["colombia-64", "peru-68", "ecuador-72", "fleur-de-sel-bar", "madagascar-80", "venezuela-76", "midnight-truffle"]);
      expect(slugs((await store.list({ ...base, sort: "price_desc" })).items)).toEqual(["midnight-truffle", "venezuela-76", "madagascar-80", "fleur-de-sel-bar", "ecuador-72", "peru-68", "colombia-64"]);
    });

    it("sorts by cacao percentage, the highest first, and the order of the shop when it is the same", async () => {
      expect(slugs((await store.list({ ...base, sort: "pct_desc" })).items)).toEqual(["madagascar-80", "venezuela-76", "ecuador-72", "midnight-truffle", "peru-68", "fleur-de-sel-bar", "colombia-64"]);
    });

    it("sorts by newest, the one that was made last first", async () => {
      expect(slugs((await store.list({ ...base, sort: "newest" })).items)).toEqual(["fleur-de-sel-bar", "midnight-truffle", "madagascar-80", "colombia-64", "venezuela-76", "peru-68", "ecuador-72"]);
    });

    it("gives a page at a time, and the total of all of them", async () => {
      const first = await store.list({ ...base, limit: 3 });
      const second = await store.list({ ...base, limit: 3, page: 2 });
      const third = await store.list({ ...base, limit: 3, page: 3 });

      expect(slugs(first.items)).toEqual(["ecuador-72", "peru-68", "venezuela-76"]);
      expect(slugs(second.items)).toEqual(["madagascar-80", "midnight-truffle", "colombia-64"]);
      expect(slugs(third.items)).toEqual(["fleur-de-sel-bar"]);
      expect([first.total, second.total, third.total]).toEqual([7, 7, 7]);
    });

    it("gives an empty page, and still the total, for a page after the last", async () => {
      expect(await store.list({ ...base, limit: 3, page: 9 })).toEqual({ items: [], total: 7 });
    });
  });

  describe("products that are switched off", () => {
    it("are not listed or found, unless the team asks for them", async () => {
      const colombia = (await store.findBySlug("colombia-64"))!;
      await store.update(colombia.id, { active: false });

      expect((await store.list(base)).total).toBe(6);
      expect((await store.list({ ...base, includeInactive: true })).total).toBe(7);
      expect(await store.findBySlug("colombia-64")).toBeNull();
      expect(await store.findById(colombia.id)).toBeNull();
      expect(await store.findBySlug("colombia-64", { includeInactive: true })).toMatchObject({ slug: "colombia-64", active: false });
      expect(await store.findByIds([colombia.id])).toEqual([]);
      expect(slugs(await store.related((await store.findBySlug("peru-68"))!, 10))).not.toContain("colombia-64");
    });
  });

  describe("finding one", () => {
    it("finds a product by its slug, in any case", async () => {
      expect(await store.findBySlug("PERU-68")).toMatchObject({ slug: "peru-68", sku: "SC-PER-068", quantity: 60 });
      expect(await store.findBySlug("nothing-here")).toBeNull();
      expect(await store.findBySlug({ $ne: null } as unknown as string)).toBeNull();
    });

    it("finds a product by its id, and nothing for an id that is not one", async () => {
      const peru = (await store.findBySlug("peru-68"))!;

      expect(await store.findById(peru.id)).toEqual(peru);
      expect(await store.findById(missingId)).toBeNull();
      expect(await store.findById("not an id")).toBeNull();
    });

    it("finds several by their ids, in the order given, once each, leaving out the ones that are not there", async () => {
      const peru = (await store.findBySlug("peru-68"))!;
      const ecuador = (await store.findBySlug("ecuador-72"))!;

      const found = await store.findByIds([ecuador.id, missingId, peru.id, ecuador.id, "not an id"]);

      expect(slugs(found)).toEqual(["ecuador-72", "peru-68"]);
      expect(await store.findByIds([])).toEqual([]);
      expect(await store.findByIds(["not an id"])).toEqual([]);
    });

    it("finds related products: the same category or origin, never itself, in the order of the shop", async () => {
      const ecuador = (await store.findBySlug("ecuador-72"))!;
      const truffle = (await store.findBySlug("midnight-truffle"))!;

      expect(slugs(await store.related(ecuador, 4))).toEqual(["peru-68", "venezuela-76", "colombia-64", "madagascar-80"]);
      expect(slugs(await store.related(ecuador, 10))).toEqual(["peru-68", "venezuela-76", "colombia-64", "madagascar-80", "midnight-truffle", "fleur-de-sel-bar"]);
      expect(slugs(await store.related(truffle, 4))).toEqual(["ecuador-72", "fleur-de-sel-bar"]);
    });
  });

  describe("making and changing products", () => {
    const fresh = () => ({ ...structuredClone(seedProducts[0].product), slug: "new-bar", sku: "SC-NEW-001", name: { en: "New Bar", es: "Barra Nueva" } });

    it("makes a product with its stock, and finds it by its new text", async () => {
      const made = await store.create(fresh(), 25);

      expect(made).toMatchObject({ slug: "new-bar", sku: "SC-NEW-001", quantity: 25, active: true });
      expect(made.id).toMatch(/^[0-9a-f]{24}$/);
      expect(slugs((await store.list({ ...base, q: "barra nueva" })).items)).toEqual(["new-bar"]);
    });

    it("refuses a slug or a SKU that another product has, saying which", async () => {
      await expect(store.create({ ...fresh(), slug: "peru-68" }, 1)).rejects.toMatchObject({ status: 409, code: "SLUG_TAKEN" });
      await expect(store.create({ ...fresh(), sku: "sc-per-068" }, 1)).rejects.toMatchObject({ status: 409, code: "SKU_TAKEN" });
      expect((await store.list(base)).total).toBe(7);
    });

    it("changes parts of a product, and the search follows the new name", async () => {
      const peru = (await store.findBySlug("peru-68"))!;

      const changed = await store.update(peru.id, { price: 1250, featured: false, name: { en: "Peru Reserve 68%", es: "Perú Reserva 68%" } });

      expect(changed).toMatchObject({ price: 1250, featured: false, name: { en: "Peru Reserve 68%", es: "Perú Reserva 68%" }, percentage: 68 });
      expect(slugs((await store.list({ ...base, q: "reserva" })).items)).toEqual(["peru-68"]);
    });

    it("refuses to move a product to the slug of another one", async () => {
      const peru = (await store.findBySlug("peru-68"))!;

      await expect(store.update(peru.id, { slug: "ecuador-72" })).rejects.toMatchObject({ status: 409, code: "SLUG_TAKEN" });
      await expect(store.update(peru.id, { sku: "SC-ECU-072" })).rejects.toMatchObject({ status: 409, code: "SKU_TAKEN" });
    });

    it("answers null for a product that is not there", async () => {
      expect(await store.update(missingId, { price: 100 })).toBeNull();
      expect(await store.update("not an id", { price: 100 })).toBeNull();
    });

    it("sets the stock, to zero as well, and the number for low stock when it is given", async () => {
      const peru = (await store.findBySlug("peru-68"))!;

      expect(await store.setInventory(peru.id, { quantity: 0 })).toMatchObject({ quantity: 0, lowStockThreshold: 10 });
      expect(await store.setInventory(peru.id, { quantity: 40, lowStockThreshold: 25 })).toMatchObject({ quantity: 40, lowStockThreshold: 25 });
      expect(await store.findBySlug("peru-68")).toMatchObject({ quantity: 40, lowStockThreshold: 25 });
    });

    it("answers null when the stock is for a product that is not there", async () => {
      expect(await store.setInventory(missingId, { quantity: 5 })).toBeNull();
      expect(await store.setInventory("not an id", { quantity: 5 })).toBeNull();
    });
  });

  describe("the seed", () => {
    it("makes a product when its slug is new, and changes it when it is not", async () => {
      const [only] = seedProducts;

      expect(await store.upsertBySlug({ ...structuredClone(only.product), slug: "another-bar", sku: "SC-OTH-001" }, 5)).toBe("created");
      expect(await store.upsertBySlug({ ...structuredClone(only.product), slug: "another-bar", sku: "SC-OTH-001", price: 999 }, 5)).toBe("updated");
      expect(await store.findBySlug("another-bar")).toMatchObject({ price: 999 });
      expect((await store.list(base)).total).toBe(8);
    });

    it("puts the text back as it is in the seed, but never the stock numbers", async () => {
      const peru = seedProducts.find((entry) => entry.product.slug === "peru-68")!;
      const found = (await store.findBySlug("peru-68"))!;
      await store.setInventory(found.id, { quantity: 3 });
      await store.update(found.id, { price: 1 });

      await store.upsertBySlug(structuredClone(peru.product), peru.quantity);

      expect(await store.findBySlug("peru-68")).toMatchObject({ price: 1100, quantity: 3 });
    });

    it("does not make a second copy when it runs twice", async () => {
      for (const { product, quantity } of seedProducts) await store.upsertBySlug(structuredClone(product), quantity);
      for (const { product, quantity } of seedProducts) await store.upsertBySlug(structuredClone(product), quantity);

      expect((await store.list(base)).total).toBe(7);
    });
  });
}

describe("the in-memory product store", () => {
  storeContract(() => createMemoryProductStore());
});

// These need a real MongoDB, so they only run when you give one, for example:
//   MONGODB_TEST_URI=mongodb://127.0.0.1:27017/solcacao_test pnpm test
// The collections are emptied, so the name of the database has to contain "test".
const testUri = process.env.MONGODB_TEST_URI;

describe.skipIf(!testUri)("the MongoDB product store", () => {
  beforeAll(async () => {
    if (!/test/i.test(new URL(testUri!).pathname)) throw new Error("MONGODB_TEST_URI must point to a database with test in its name");
    await mongoose.connect(testUri!);
    await Product.init();
    await Inventory.init();
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  storeContract(async () => {
    await Product.deleteMany({});
    await Inventory.deleteMany({});
    return createMongoProductStore();
  });

  // a product that is not one of the seven, so that it does not meet their slug or SKU
  const good = () => ({ ...structuredClone(seedProducts[0].product), slug: "extra-bar", sku: "SC-EXTRA-001" });

  it("keeps the stock of a product in its own document, one for each product", async () => {
    const store = createMongoProductStore();
    const made = await store.create(good(), 12);

    expect(await Inventory.countDocuments({ productId: made.id })).toBe(1);
    await store.setInventory(made.id, { quantity: 4 });
    expect(await Inventory.countDocuments({ productId: made.id })).toBe(1);
    await expect(Inventory.create({ productId: made.id, quantity: 1 })).rejects.toMatchObject({ code: 11000 });
  });

  it("has unique indexes for the slug and the SKU", async () => {
    const indexes = await Product.collection.indexes();

    expect(indexes.some((index) => index.unique === true && index.key.slug === 1)).toBe(true);
    expect(indexes.some((index) => index.unique === true && index.key.sku === 1)).toBe(true);
  });

  it.each([
    ["a price that is not whole cents", { price: 12.5 }],
    ["a price of nothing", { price: 0 }],
    ["a percentage over 100", { percentage: 101 }],
    ["a percentage that is not whole", { percentage: 72.5 }],
    ["a category that does not exist", { category: "cake" }],
    ["a note that does not exist", { notes: ["minty"] }],
    ["a slug with capitals or spaces", { slug: "Bad Slug" }],
    ["an image that is a script", { images: ["javascript:alert(1)"] }],
    ["an image that is not on https", { images: ["http://example.com/a.jpg"] }],
    ["no images", { images: [] }],
    ["a month that is not a month", { harvestMonth: "2024-13" }],
    ["a name without Spanish", { name: { en: "Only English", es: "" } }],
  ])("refuses %s", async (_what, change) => {
    const store = createMongoProductStore();

    await expect(store.create({ ...good(), ...change } as never, 5)).rejects.toThrow();
    expect(await Product.countDocuments({})).toBe(7);
  });

  it("does not keep a product when its stock could not be made", async () => {
    const store = createMongoProductStore();

    await expect(store.create(good(), -5)).rejects.toThrow();

    expect(await Product.countDocuments({})).toBe(7);
  });

  it("refuses a stock that is negative or not whole, and keeps the old one", async () => {
    const store = createMongoProductStore();
    const made = await store.create(good(), 12);

    await expect(store.setInventory(made.id, { quantity: -1 })).rejects.toThrow();
    await expect(store.setInventory(made.id, { quantity: 2.5 })).rejects.toThrow();

    expect((await store.findById(made.id))?.quantity).toBe(12);
  });

  it("does not let the search text out of the model, so it cannot be set by hand", async () => {
    const store = createMongoProductStore();
    const made = await store.create(good(), 12);

    await store.update(made.id, { searchText: "everything" } as never);

    expect((await store.list({ sort: "featured", page: 1, limit: 12, q: "everything" })).total).toBe(0);
  });
});

describe("the MongoDB product store without a connection", () => {
  it("answers 503", async () => {
    if (mongoose.connection.readyState !== 0) return;
    const store = createMongoProductStore();

    for (const attempt of [() => store.list(base), () => store.findBySlug("x"), () => store.findById(missingId), () => store.findByIds([missingId]), () => store.create(seedProducts[0].product, 1), () => store.setInventory(missingId, { quantity: 1 })]) {
      await expect(attempt()).rejects.toMatchObject({ status: 503, code: "DATABASE_UNAVAILABLE" });
    }
  });
});
