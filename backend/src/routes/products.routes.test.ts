import express from "express";
import { pino } from "pino";
import { pinoHttp } from "pino-http";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { signToken } from "../middleware/auth.ts";
import { errorHandler } from "../middleware/errorHandler.ts";
import { detectLanguage } from "../middleware/language.ts";
import { seedProducts } from "../seed/products.seed.ts";
import { createProductService } from "../services/product.service.ts";
import { createMemoryProductStore } from "../test/memoryProductStore.ts";
import { createProductsRouter, createStaffProductsRouter } from "./products.routes.ts";

async function build() {
  const store = createMemoryProductStore();
  for (const { product, quantity } of seedProducts) await store.create(product, quantity);
  const service = createProductService({ products: store });

  const app = express();
  app.use(pinoHttp({ logger: pino({ level: "silent" }) }));
  app.use(express.json({ limit: "100kb" }));
  app.use(detectLanguage);
  app.use("/api/products", createProductsRouter({ service }));
  app.use("/api/staff/products", createStaffProductsRouter({ service }));
  app.use(errorHandler);
  return { app, store };
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const adminToken = () => signToken({ id: "64b7f0c2a1b2c3d4e5f60700", role: "admin", accountType: "retail" });
const userToken = () => signToken({ id: "64b7f0c2a1b2c3d4e5f60701", role: "user", accountType: "retail" });
const slugs = (items: { slug: string }[]) => items.map((item) => item.slug);

describe("GET /api/products", () => {
  it("lists the products with the page, the limit and the total", async () => {
    const { app } = await build();

    const res = await request(app).get("/api/products");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, limit: 12, total: 7 });
    expect(slugs(res.body.items)).toEqual(["ecuador-72", "peru-68", "venezuela-76", "madagascar-80", "midnight-truffle", "colombia-64", "fleur-de-sel-bar"]);
  });

  it("gives each product its text in one language, its price in cents, its stock and its availability", async () => {
    const { app } = await build();

    const { body } = await request(app).get("/api/products?origin=venezuela");

    expect(body.items[0]).toMatchObject({
      slug: "venezuela-76",
      name: "Venezuela 76%",
      caption: "Venezuela, 76% cacao",
      price: 1500,
      stock: 6,
      availability: "low",
      origin: "venezuela",
      originName: "Venezuela",
      percentage: 76,
      category: "bar",
      notes: ["floral", "smoky"],
    });
    expect(body.items[0].images).toHaveLength(3);
    expect(body.items[0].thumbnail).toMatch(/^https:\/\//);
    // one language only, never both
    expect(typeof body.items[0].name).toBe("string");
  });

  it("answers in Spanish for ?lang=es and for the Accept-Language header, and the query wins", async () => {
    const { app } = await build();

    const byQuery = await request(app).get("/api/products?origin=peru&lang=es");
    const byHeader = await request(app).get("/api/products?origin=peru").set("Accept-Language", "es-MX,es;q=0.9,en;q=0.8");
    const queryWins = await request(app).get("/api/products?origin=peru&lang=en").set("Accept-Language", "es");

    expect(byQuery.body.items[0]).toMatchObject({ name: "Perú 68%", originName: "Perú", caption: "Perú, 68% de cacao", tastingSummary: "almendra tostada, suelo de bosque" });
    expect(byHeader.body.items[0].name).toBe("Perú 68%");
    expect(queryWins.body.items[0].name).toBe("Peru 68%");
  });

  it("tells caches that the answer depends on the language, and may be kept for a short while", async () => {
    const { app } = await build();

    const res = await request(app).get("/api/products");

    expect(res.headers.vary).toMatch(/Accept-Language/i);
    expect(res.headers["cache-control"]).toBe("public, max-age=30");
  });

  it("filters like the shop page does", async () => {
    const { app } = await build();

    const res = await request(app).get("/api/products?origin=ecuador&category=bar,seasonal&minPct=68&notes=floral");

    expect(slugs(res.body.items)).toEqual(["ecuador-72", "fleur-de-sel-bar"]);
    expect(res.body.total).toBe(2);
  });

  it("takes a list as commas or as the same name more than once, in any case", async () => {
    const { app } = await build();

    const commas = await request(app).get("/api/products?origin=peru,Colombia");
    const repeated = await request(app).get("/api/products?origin=peru&origin=colombia");

    expect(slugs(commas.body.items)).toEqual(["peru-68", "colombia-64"]);
    expect(slugs(repeated.body.items)).toEqual(["peru-68", "colombia-64"]);
  });

  it("searches names and countries in both languages, with or without accents", async () => {
    const { app } = await build();

    expect(slugs((await request(app).get("/api/products?q=per%C3%BA")).body.items)).toEqual(["peru-68"]);
    expect(slugs((await request(app).get("/api/products?q=PERU")).body.items)).toEqual(["peru-68"]);
    expect(slugs((await request(app).get("/api/products?q=trufa&lang=en")).body.items)).toEqual(["midnight-truffle"]);
    expect(slugs((await request(app).get("/api/products?q=%20%20")).body.items)).toHaveLength(7);
  });

  it("reads a search as text, never as a pattern, and a search of only accents finds nothing", async () => {
    const { app } = await build();

    for (const q of [".*", "(", "[a-z]", "%5E", "a%7Cb"]) {
      const res = await request(app).get(`/api/products?q=${q}`);
      expect(res.status, q).toBe(200);
      expect(res.body.total, q).toBe(0);
    }
  });

  it("sorts and gives a page at a time", async () => {
    const { app } = await build();

    const cheap = await request(app).get("/api/products?sort=price_asc&limit=3");
    const next = await request(app).get("/api/products?sort=price_asc&limit=3&page=2");

    expect(slugs(cheap.body.items)).toEqual(["colombia-64", "peru-68", "ecuador-72"]);
    expect(slugs(next.body.items)).toEqual(["fleur-de-sel-bar", "madagascar-80", "venezuela-76"]);
    expect(next.body).toMatchObject({ page: 2, limit: 3, total: 7 });
  });

  it("finds the featured ones for the home page", async () => {
    const { app } = await build();

    const res = await request(app).get("/api/products?featured=true&limit=5");

    expect(res.body.items).toHaveLength(5);
    expect(res.body.items.every((item: { featured: boolean }) => item.featured)).toBe(true);
  });

  it("does not show a product that is switched off", async () => {
    const { app, store } = await build();
    const colombia = (await store.findBySlug("colombia-64"))!;
    await store.update(colombia.id, { active: false });

    const list = await request(app).get("/api/products");
    const one = await request(app).get("/api/products/colombia-64");

    expect(slugs(list.body.items)).not.toContain("colombia-64");
    expect(list.body.total).toBe(6);
    expect(one.status).toBe(404);
  });

  it.each([
    ["an origin that does not exist", "origin=mars"],
    ["a category that does not exist", "category=cake"],
    ["a note that does not exist", "notes=minty"],
    ["a sort that does not exist", "sort=cheapest"],
    ["a percentage that is not a number", "minPct=abc"],
    ["a percentage over 100", "maxPct=101"],
    ["a percentage that is not whole", "minPct=60.5"],
    ["a minimum above the maximum", "minPct=80&maxPct=70"],
    ["a limit of more than 48", "limit=49"],
    ["a limit of 0", "limit=0"],
    ["a page before the first", "page=0"],
    ["a page that is not a number", "page=two"],
    ["featured that is not true or false", "featured=yes"],
    ["a search that is far too long", `q=${"a".repeat(81)}`],
    ["a search that is given twice", "q=a&q=b"],
  ])("refuses %s with 400 and says which field", async (_what, query) => {
    const { app } = await build();

    const res = await request(app).get(`/api/products?${query}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it("does not take a query operator for a value", async () => {
    const { app } = await build();

    for (const query of ["origin[$ne]=peru", "q[$regex]=.*", "category[$in][]=bar", "__proto__[admin]=true", "sort[$ne]=x"]) {
      const res = await request(app).get(`/api/products?${query}`);
      // either refused, or the strange part is ignored: it never turns into a query
      expect([200, 400], query).toContain(res.status);
      if (res.status === 200) expect(res.body.total, query).toBe(7);
    }
  });

  it("ignores parameters it does not know", async () => {
    const { app } = await build();

    expect((await request(app).get("/api/products?colour=red&utm_source=mail")).body.total).toBe(7);
  });
});

describe("GET /api/products/:slug", () => {
  it("gives one product with everything the page needs", async () => {
    const { app } = await build();

    const res = await request(app).get("/api/products/ecuador-72");

    expect(res.status).toBe(200);
    expect(res.body.product).toMatchObject({
      slug: "ecuador-72",
      sku: "SC-ECU-072",
      farm: "Finca La Perla, Esmeraldas Province",
      batchCode: "SC-2024-ECU-072",
      harvestMonth: "2024-03",
      roastMonth: "2024-06",
      stock: 120,
      availability: "in_stock",
    });
    expect(res.body.product.description).toContain("forty families");
  });

  it("answers in Spanish, and the slug can be written in capitals", async () => {
    const { app } = await build();

    const res = await request(app).get("/api/products/ECUADOR-72?lang=es");

    expect(res.body.product.description).toContain("cuarenta familias");
    expect(res.body.product.farm).toBe("Finca La Perla, provincia de Esmeraldas");
  });

  it("says sold out for a product with no stock", async () => {
    const { app } = await build();

    const res = await request(app).get("/api/products/fleur-de-sel-bar");

    expect(res.body.product).toMatchObject({ stock: 0, availability: "out" });
  });

  it("answers 404 in the standard shape for a product that is not there, and for an address that cannot be one", async () => {
    const { app } = await build();

    for (const slug of ["nothing-here", "%7B%22%24ne%22%3Anull%7D", "a".repeat(81), "-bad-", "ecuador_72"]) {
      const res = await request(app).get(`/api/products/${slug}`);
      expect(res.status, slug).toBe(404);
      expect(res.body.error).toEqual({ code: "NOT_FOUND", message: "That product wasn't found.", details: [] });
    }
  });
});

describe("GET /api/products/:slug/related", () => {
  it("gives up to four products of the same category or origin, never the product itself", async () => {
    const { app } = await build();

    const res = await request(app).get("/api/products/ecuador-72/related");

    expect(res.status).toBe(200);
    expect(slugs(res.body.items)).toEqual(["peru-68", "venezuela-76", "colombia-64", "madagascar-80"]);
  });

  it("gives fewer when there are fewer, and speaks the language of the request", async () => {
    const { app } = await build();

    const res = await request(app).get("/api/products/midnight-truffle/related?lang=es");

    expect(slugs(res.body.items)).toEqual(["ecuador-72", "fleur-de-sel-bar"]);
    expect(res.body.items[1].name).toBe("Barra Flor de Sal");
  });

  it("answers 404 for a product that is not there", async () => {
    const { app } = await build();

    expect((await request(app).get("/api/products/nothing-here/related")).status).toBe(404);
  });
});

describe("/api/staff/products", () => {
  const body = {
    slug: "Summer-Bar",
    sku: "sc-sum-001",
    name: { en: "Summer Bar", es: "Barra de Verano" },
    caption: { en: "Peru, 65% cacao", es: "Perú, 65% de cacao" },
    tastingSummary: { en: "citrus, honey", es: "cítricos, miel" },
    imageAlt: { en: "A bar on a plate", es: "Una barra en un plato" },
    farm: { en: "A farm", es: "Una finca" },
    description: { en: "A bar for summer.", es: "Una barra para el verano." },
    origin: "peru",
    originName: { en: "Peru", es: "Perú" },
    percentage: 65,
    category: "seasonal",
    price: 1250,
    notes: ["fruity"],
    thumbnail: "https://images.example.com/a.jpg?w=480",
    images: ["https://images.example.com/a.jpg?w=960"],
    batchCode: "SC-2026-SUM-001",
    harvestMonth: "2026-02",
    roastMonth: "2026-04",
    quantity: 40,
  };

  it("is for the team only", async () => {
    const { app } = await build();
    const id = "64b7f0c2a1b2c3d4e5f607ff";

    for (const [method, path] of [
      ["get", "/api/staff/products"],
      ["get", `/api/staff/products/${id}`],
      ["post", "/api/staff/products"],
      ["patch", `/api/staff/products/${id}`],
      ["put", `/api/staff/products/${id}/inventory`],
    ] as const) {
      const guest = await request(app)[method](path);
      const shopper = await request(app)[method](path).set(bearer(await userToken()));
      expect([guest.status, shopper.status], `${method} ${path}`).toEqual([401, 403]);
    }
  });

  it("lists every product, also the ones that are switched off, with both languages", async () => {
    const { app, store } = await build();
    await store.update((await store.findBySlug("colombia-64"))!.id, { active: false });

    const res = await request(app).get("/api/staff/products").set(bearer(await adminToken()));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(7);
    expect(res.body.items.find((item: { slug: string }) => item.slug === "colombia-64")).toMatchObject({ active: false, name: { en: "Colombia 64%", es: "Colombia 64%" }, quantity: 45 });
  });

  it("makes a product: the slug and SKU are tidied, and the shop shows it with its stock", async () => {
    const { app } = await build();

    const created = await request(app).post("/api/staff/products").set(bearer(await adminToken())).send(body);

    expect(created.status).toBe(201);
    expect(created.body.product).toMatchObject({ slug: "summer-bar", sku: "SC-SUM-001", quantity: 40, active: true, featured: false, price: 1250 });
    const shop = await request(app).get("/api/products/summer-bar?lang=es");
    expect(shop.body.product).toMatchObject({ name: "Barra de Verano", stock: 40, availability: "in_stock", price: 1250 });
  });

  it("refuses a slug or a SKU that is already used, saying which", async () => {
    const { app } = await build();
    const token = await adminToken();

    const slug = await request(app).post("/api/staff/products").set(bearer(token)).send({ ...body, slug: "peru-68" });
    const sku = await request(app).post("/api/staff/products").set(bearer(token)).send({ ...body, sku: "SC-PER-068" });

    expect([slug.status, slug.body.error.code]).toEqual([409, "SLUG_TAKEN"]);
    expect([sku.status, sku.body.error.code]).toEqual([409, "SKU_TAKEN"]);
  });

  it.each([
    ["a price in dollars with cents", { price: 12.5 }],
    ["a price that is text", { price: "1200" }],
    ["a price of nothing", { price: 0 }],
    ["a percentage that is too high", { percentage: 150 }],
    ["an origin that does not exist", { origin: "mars" }],
    ["a category that does not exist", { category: "cake" }],
    ["a note given twice", { notes: ["fruity", "fruity"] }],
    ["a name without Spanish", { name: { en: "Only English" } }],
    ["a name that is only tags", { name: { en: "<b></b>", es: "<i></i>" } }],
    ["an image that is a script", { images: ["javascript:alert(1)"], thumbnail: "javascript:alert(1)" }],
    ["an image on plain http", { images: ["http://example.com/a.jpg"] }],
    ["no images", { images: [] }],
    ["a month that is not a month", { harvestMonth: "2026-13" }],
    ["a negative stock", { quantity: -1 }],
    ["a stock that is not whole", { quantity: 2.5 }],
    ["a slug with spaces", { slug: "bad slug" }],
  ])("refuses %s", async (_what, change) => {
    const { app, store } = await build();

    const res = await request(app).post("/api/staff/products").set(bearer(await adminToken())).send({ ...body, ...change });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect((await store.list({ sort: "featured", page: 1, limit: 48, includeInactive: true })).total).toBe(7);
  });

  it.each([
    ["the id", { id: "64b7f0c2a1b2c3d4e5f607ff" }],
    ["the search text", { searchText: "everything" }],
    ["the dates", { createdAt: "2020-01-01T00:00:00.000Z" }],
    ["a field that does not exist", { discount: 50 }],
  ])("refuses a product that sets %s", async (_what, extra) => {
    const { app } = await build();

    const res = await request(app).post("/api/staff/products").set(bearer(await adminToken())).send({ ...body, ...extra });

    expect(res.status).toBe(400);
  });

  it("strips tags from the text of a product", async () => {
    const { app } = await build();

    const res = await request(app)
      .post("/api/staff/products")
      .set(bearer(await adminToken()))
      .send({ ...body, name: { en: "<script>alert(1)</script>Summer Bar", es: "Barra <b>de</b> Verano" } });

    expect(res.status).toBe(201);
    expect(res.body.product.name).toEqual({ en: "Summer Bar", es: "Barra de Verano" });
  });

  it("changes parts of a product, and the shop shows the change", async () => {
    const { app } = await build();
    const token = await adminToken();
    const { body: listed } = await request(app).get("/api/products/peru-68");

    const res = await request(app).patch(`/api/staff/products/${listed.product.id}`).set(bearer(token)).send({ price: 1300, featured: false, name: { en: "Peru Reserve 68%", es: "Perú Reserva 68%" } });

    expect(res.status).toBe(200);
    expect(res.body.product).toMatchObject({ price: 1300, featured: false });
    expect((await request(app).get("/api/products/peru-68?lang=es")).body.product).toMatchObject({ name: "Perú Reserva 68%", price: 1300 });
  });

  it("switches a product off and on", async () => {
    const { app } = await build();
    const token = await adminToken();
    const { id } = (await request(app).get("/api/products/peru-68")).body.product;

    await request(app).patch(`/api/staff/products/${id}`).set(bearer(token)).send({ active: false });
    expect((await request(app).get("/api/products/peru-68")).status).toBe(404);

    await request(app).patch(`/api/staff/products/${id}`).set(bearer(token)).send({ active: true });
    expect((await request(app).get("/api/products/peru-68")).status).toBe(200);
  });

  it("does not let a change carry the stock, an empty change or an unknown field", async () => {
    const { app } = await build();
    const token = await adminToken();
    const { id } = (await request(app).get("/api/products/peru-68")).body.product;

    for (const change of [{ quantity: 5 }, {}, { searchText: "x" }, { price: 0 }]) {
      const res = await request(app).patch(`/api/staff/products/${id}`).set(bearer(token)).send(change);
      expect(res.status, JSON.stringify(change)).toBe(400);
    }
    expect((await request(app).get("/api/products/peru-68")).body.product.stock).toBe(60);
  });

  it("sets the stock, to zero too, and the shop shows the new availability", async () => {
    const { app } = await build();
    const token = await adminToken();
    const { id } = (await request(app).get("/api/products/peru-68")).body.product;

    const sold = await request(app).put(`/api/staff/products/${id}/inventory`).set(bearer(token)).send({ quantity: 0 });
    expect(sold.status).toBe(200);
    expect((await request(app).get("/api/products/peru-68")).body.product).toMatchObject({ stock: 0, availability: "out" });

    await request(app).put(`/api/staff/products/${id}/inventory`).set(bearer(token)).send({ quantity: 8, lowStockThreshold: 5 });
    expect((await request(app).get("/api/products/peru-68")).body.product).toMatchObject({ stock: 8, availability: "in_stock" });
    await request(app).put(`/api/staff/products/${id}/inventory`).set(bearer(token)).send({ quantity: 5 });
    expect((await request(app).get("/api/products/peru-68")).body.product).toMatchObject({ stock: 5, availability: "low" });
  });

  it.each([
    ["a stock below zero", { quantity: -3 }],
    ["a stock that is not whole", { quantity: 1.5 }],
    ["a stock that is text", { quantity: "5" }],
    ["no stock", {}],
    ["something besides the stock", { quantity: 5, price: 1 }],
  ])("refuses %s", async (_what, change) => {
    const { app } = await build();
    const { id } = (await request(app).get("/api/products/peru-68")).body.product;

    const res = await request(app).put(`/api/staff/products/${id}/inventory`).set(bearer(await adminToken())).send(change);

    expect(res.status).toBe(400);
    expect((await request(app).get("/api/products/peru-68")).body.product.stock).toBe(60);
  });

  it("answers 404 for a product that is not there, and 400 for an id that is not an id", async () => {
    const { app } = await build();
    const token = await adminToken();

    expect((await request(app).patch("/api/staff/products/64b7f0c2a1b2c3d4e5f607ff").set(bearer(token)).send({ price: 100 })).status).toBe(404);
    expect((await request(app).put("/api/staff/products/64b7f0c2a1b2c3d4e5f607ff/inventory").set(bearer(token)).send({ quantity: 1 })).status).toBe(404);
    expect((await request(app).get("/api/staff/products/64b7f0c2a1b2c3d4e5f607ff").set(bearer(token))).status).toBe(404);
    expect((await request(app).patch("/api/staff/products/abc").set(bearer(token)).send({ price: 100 })).status).toBe(400);
  });

  it("is never kept by a cache", async () => {
    const { app } = await build();

    const res = await request(app).get("/api/staff/products").set(bearer(await adminToken()));

    expect(res.headers["cache-control"]).toBe("no-store");
  });
});
