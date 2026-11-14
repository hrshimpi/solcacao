import cookieParser from "cookie-parser";
import express from "express";
import { pino } from "pino";
import { pinoHttp } from "pino-http";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { cookieSecret } from "../config/secrets.ts";
import { signToken } from "../middleware/auth.ts";
import { errorHandler } from "../middleware/errorHandler.ts";
import { detectLanguage } from "../middleware/language.ts";
import { seedProducts } from "../seed/products.seed.ts";
import { createCartService } from "../services/cart.service.ts";
import { createMemoryCartStore } from "../test/memoryCartStore.ts";
import { createMemoryProductStore } from "../test/memoryProductStore.ts";
import { createCartRouter } from "./cart.routes.ts";

async function build(options: { secureCookie?: boolean } = {}) {
  const products = createMemoryProductStore();
  const ids: Record<string, string> = {};
  for (const { product, quantity } of seedProducts) ids[product.slug] = (await products.create(product, quantity)).id;
  const carts = createMemoryCartStore();
  const service = createCartService({ carts, products });

  const app = express();
  app.use(pinoHttp({ logger: pino({ level: "silent" }) }));
  app.use(cookieParser(cookieSecret));
  app.use(express.json({ limit: "100kb" }));
  app.use(detectLanguage);
  app.use("/api/cart", createCartRouter({ service, secureCookie: options.secureCookie ?? false }));
  app.use(errorHandler);
  return { app, ids, products, carts };
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const tokenFor = (id: string) => signToken({ id, role: "user", accountType: "retail" });
const userA = "64b7f0c2a1b2c3d4e5f60718";
const userB = "64b7f0c2a1b2c3d4e5f60719";
const cookieLine = (res: request.Response) => ((res.headers["set-cookie"] as unknown as string[] | undefined) ?? []).find((line) => line.startsWith("sc_guest="));
const cookieOf = (res: request.Response) => cookieLine(res)?.split(";")[0];

describe("a visitor's cart", () => {
  it("is empty at the start, and no cookie is made just for looking", async () => {
    const { app } = await build();

    const res = await request(app).get("/api/cart");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ cart: { lines: [], itemCount: 0, subtotal: 0, updatedAt: null } });
    expect(cookieLine(res)).toBeUndefined();
  });

  it("is made with the first item, with a signed cookie that scripts cannot read", async () => {
    const { app, ids } = await build();

    const res = await request(app).post("/api/cart/items").send({ kind: "product", productId: ids["peru-68"], quantity: 2 });

    expect(res.status).toBe(200);
    expect(res.body.cart).toMatchObject({ itemCount: 2, subtotal: 2200 });
    const line = cookieLine(res);
    expect(line).toMatch(/^sc_guest=s%3A/);
    expect(line).toMatch(/HttpOnly/i);
    expect(line).toMatch(/SameSite=Lax/i);
    expect(line).toMatch(/Path=\/api(;|$)/);
    expect(line).toMatch(/Expires=/i);
    expect(line).not.toMatch(/Secure/i);
  });

  it("makes the cookie https only in production", async () => {
    const { app, ids } = await build({ secureCookie: true });

    const res = await request(app).post("/api/cart/items").send({ kind: "product", productId: ids["peru-68"] });

    expect(cookieLine(res)).toMatch(/; Secure/i);
  });

  it("comes back with the cookie, and a change adds to the same cart", async () => {
    const { app, ids } = await build();
    const first = await request(app).post("/api/cart/items").send({ kind: "product", productId: ids["peru-68"] });
    const cookie = cookieOf(first)!;

    const second = await request(app).post("/api/cart/items").set("Cookie", cookie).send({ kind: "product", productId: ids["ecuador-72"] });
    const read = await request(app).get("/api/cart").set("Cookie", cookie);

    expect(second.body.cart.lines).toHaveLength(2);
    expect(read.body.cart.lines.map((line: { products: { slug: string }[] }) => line.products[0].slug)).toEqual(["peru-68", "ecuador-72"]);
  });

  it("is kept apart from the cart of another visitor", async () => {
    const { app, ids } = await build();
    const one = await request(app).post("/api/cart/items").send({ kind: "product", productId: ids["peru-68"] });
    const other = await request(app).post("/api/cart/items").send({ kind: "product", productId: ids["ecuador-72"] });

    expect(cookieOf(one)).not.toBe(cookieOf(other));
    expect((await request(app).get("/api/cart").set("Cookie", cookieOf(one)!)).body.cart.lines).toHaveLength(1);
    expect((await request(app).get("/api/cart").set("Cookie", cookieOf(other)!)).body.cart.lines[0].products[0].slug).toBe("ecuador-72");
  });

  it("cannot be taken over with a cookie that was made up or changed", async () => {
    const { app, ids } = await build();
    const mine = await request(app).post("/api/cart/items").send({ kind: "product", productId: ids["peru-68"] });
    const real = decodeURIComponent(cookieOf(mine)!.slice("sc_guest=".length));
    const id = real.slice(2, real.indexOf("."));

    for (const forged of [`sc_guest=${encodeURIComponent(id)}`, `sc_guest=${encodeURIComponent(`s:${id}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`)}`, `sc_guest=${encodeURIComponent(`s:${id}x.${real.split(".")[1]}`)}`, "sc_guest=s%3Aabc.def", "sc_guest="]) {
      const res = await request(app).get("/api/cart").set("Cookie", forged);
      expect(res.status, forged).toBe(200);
      expect(res.body.cart.lines, forged).toEqual([]);
    }
  });

  it("gets a new cart, not an error, when it adds with a cookie that is not good", async () => {
    const { app, ids } = await build();

    const res = await request(app).post("/api/cart/items").set("Cookie", "sc_guest=s%3Aabc.def").send({ kind: "product", productId: ids["peru-68"] });

    expect(res.status).toBe(200);
    expect(cookieLine(res)).toBeDefined();
    expect(res.body.cart.lines).toHaveLength(1);
  });
});

describe("a signed in user's cart", () => {
  it("belongs to the user, whatever the device, and is not the cart of the cookie", async () => {
    const { app, ids } = await build();
    const token = await tokenFor(userA);
    const visitor = await request(app).post("/api/cart/items").send({ kind: "product", productId: ids["colombia-64"] });

    const added = await request(app).post("/api/cart/items").set(bearer(token)).set("Cookie", cookieOf(visitor)!).send({ kind: "product", productId: ids["peru-68"], quantity: 3 });
    const otherDevice = await request(app).get("/api/cart").set(bearer(token));

    expect(added.body.cart.lines.map((line: { products: { slug: string }[] }) => line.products[0].slug)).toEqual(["peru-68"]);
    expect(otherDevice.body.cart.itemCount).toBe(3);
    // a signed in change makes no cookie
    expect(cookieLine(added)).toBeUndefined();
  });

  it("is not seen by another user", async () => {
    const { app, ids } = await build();
    await request(app).post("/api/cart/items").set(bearer(await tokenFor(userA))).send({ kind: "product", productId: ids["peru-68"] });

    const res = await request(app).get("/api/cart").set(bearer(await tokenFor(userB)));

    expect(res.body.cart.lines).toEqual([]);
  });

  it("is never taken for a visitor's cart when the token is not good", async () => {
    const { app, ids } = await build();
    await request(app).post("/api/cart/items").set(bearer(await tokenFor(userA))).send({ kind: "product", productId: ids["peru-68"] });
    const expired = await signToken({ id: userA, role: "user" }, Math.floor(Date.now() / 1000) - 60);

    const withExpired = await request(app).get("/api/cart").set(bearer(expired));
    const withJunk = await request(app).get("/api/cart").set(bearer("not a token"));
    const adding = await request(app).post("/api/cart/items").set(bearer(expired)).send({ kind: "product", productId: ids["peru-68"] });

    expect([withExpired.status, withExpired.body.error.code]).toEqual([401, "TOKEN_EXPIRED"]);
    expect([withJunk.status, withJunk.body.error.code]).toEqual([401, "UNAUTHENTICATED"]);
    expect([adding.status, adding.body.error.code]).toEqual([401, "TOKEN_EXPIRED"]);
    expect(cookieLine(adding)).toBeUndefined();
  });
});

describe("changing the cart", () => {
  it("sets the quantity of a line, and takes a line away", async () => {
    const { app, ids } = await build();
    const token = await tokenFor(userA);
    const added = await request(app).post("/api/cart/items").set(bearer(token)).send({ kind: "product", productId: ids["peru-68"] });
    const lineId = added.body.cart.lines[0].lineId;

    const set = await request(app).patch(`/api/cart/items/${lineId}`).set(bearer(token)).send({ quantity: 5 });
    expect(set.body.cart).toMatchObject({ itemCount: 5, subtotal: 5500 });

    const removed = await request(app).delete(`/api/cart/items/${lineId}`).set(bearer(token));
    expect(removed.body.cart.lines).toEqual([]);
  });

  it("empties the cart of a user, and of a visitor with a cookie, and a visitor with none gets an empty cart", async () => {
    const { app, ids } = await build();
    const token = await tokenFor(userA);
    await request(app).post("/api/cart/items").set(bearer(token)).send({ kind: "product", productId: ids["peru-68"] });
    const visitor = await request(app).post("/api/cart/items").send({ kind: "product", productId: ids["peru-68"] });

    expect((await request(app).delete("/api/cart").set(bearer(token))).body.cart.lines).toEqual([]);
    expect((await request(app).delete("/api/cart").set("Cookie", cookieOf(visitor)!)).body.cart.lines).toEqual([]);
    expect((await request(app).delete("/api/cart")).body.cart.lines).toEqual([]);
    expect((await request(app).get("/api/cart").set(bearer(token))).body.cart.lines).toEqual([]);
  });

  it("answers 404 for a line that is not in the cart, and for a line of somebody else's cart", async () => {
    const { app, ids } = await build();
    const a = await tokenFor(userA);
    const b = await tokenFor(userB);
    const added = await request(app).post("/api/cart/items").set(bearer(a)).send({ kind: "product", productId: ids["peru-68"] });
    const lineId = added.body.cart.lines[0].lineId;

    for (const res of [
      await request(app).patch(`/api/cart/items/${lineId}`).set(bearer(b)).send({ quantity: 2 }),
      await request(app).delete(`/api/cart/items/${lineId}`).set(bearer(b)),
      await request(app).patch(`/api/cart/items/p-${ids["ecuador-72"]}`).set(bearer(a)).send({ quantity: 2 }),
    ]) {
      expect(res.status).toBe(404);
      expect(res.body.error).toEqual({ code: "NOT_FOUND", message: "That item isn't in your cart.", details: [] });
    }
    expect((await request(app).get("/api/cart").set(bearer(a))).body.cart.itemCount).toBe(1);
  });

  it("answers 409 INSUFFICIENT_STOCK with how many there can be", async () => {
    const { app, ids } = await build();

    const res = await request(app).post("/api/cart/items").send({ kind: "product", productId: ids["venezuela-76"], quantity: 9 });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: "INSUFFICIENT_STOCK", details: [{ field: "quantity", available: 6 }] });
  });

  it("answers 404 for a product that is not there", async () => {
    const { app } = await build();

    const res = await request(app).post("/api/cart/items").send({ kind: "product", productId: "64b7f0c2a1b2c3d4e5f607ff" });

    expect(res.status).toBe(404);
    expect(cookieLine(res)).toBeDefined();
  });

  it("adds a sampler of four to six products as one line", async () => {
    const { app, ids } = await build();

    const res = await request(app)
      .post("/api/cart/items")
      .send({ kind: "sampler", productIds: ["ecuador-72", "peru-68", "venezuela-76", "colombia-64", "madagascar-80"].map((slug) => ids[slug]) });

    expect(res.status).toBe(200);
    expect(res.body.cart.lines).toHaveLength(1);
    expect(res.body.cart.lines[0]).toMatchObject({ kind: "sampler", unitPrice: 1200 + 1100 + 1500 + 1000 + 1400 });
  });
});

describe("what the cart refuses", () => {
  const productId = "64b7f0c2a1b2c3d4e5f60a01";

  it.each([
    ["an item of a kind that does not exist", { kind: "gift", productId }],
    ["no kind", { productId }],
    ["a product id that is not an id", { kind: "product", productId: "abc" }],
    ["a product id that is a query", { kind: "product", productId: { $ne: null } }],
    ["a quantity of 0", { kind: "product", productId, quantity: 0 }],
    ["a quantity over 99", { kind: "product", productId, quantity: 100 }],
    ["a quantity that is not whole", { kind: "product", productId, quantity: 1.5 }],
    ["a quantity that is text", { kind: "product", productId, quantity: "2" }],
    ["a price from the client", { kind: "product", productId, quantity: 1, price: 1 }],
    ["a locked price from the client", { kind: "product", productId, unitPrice: 1 }],
    ["a sampler of three", { kind: "sampler", productIds: [productId, "64b7f0c2a1b2c3d4e5f60a02", "64b7f0c2a1b2c3d4e5f60a03"] }],
    ["a sampler of seven", { kind: "sampler", productIds: Array.from({ length: 7 }, (_, index) => `64b7f0c2a1b2c3d4e5f60a0${index}`) }],
    ["a sampler with a product twice", { kind: "sampler", productIds: [productId, productId, "64b7f0c2a1b2c3d4e5f60a02", "64b7f0c2a1b2c3d4e5f60a03"] }],
    ["a sampler without a list", { kind: "sampler", productIds: "x" }],
    ["a product given as a sampler", { kind: "product", productIds: [productId] }],
  ])("refuses %s with 400, and makes no cookie", async (_what, body) => {
    const { app } = await build();

    const res = await request(app).post("/api/cart/items").send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(cookieLine(res)).toBeUndefined();
  });

  it("refuses a body that is not an object, and no body", async () => {
    const { app } = await build();

    for (const body of [[], "text", 5, null]) {
      expect((await request(app).post("/api/cart/items").set("Content-Type", "application/json").send(JSON.stringify(body))).status).toBe(400);
    }
    expect((await request(app).post("/api/cart/items")).status).toBe(400);
  });

  it.each([
    ["a quantity of 0", { quantity: 0 }],
    ["no quantity", {}],
    ["a price", { quantity: 1, unitPrice: 1 }],
    ["a quantity that is not a number", { quantity: "1" }],
  ])("refuses to set %s", async (_what, body) => {
    const { app, ids } = await build();
    const token = await tokenFor(userA);
    const added = await request(app).post("/api/cart/items").set(bearer(token)).send({ kind: "product", productId: ids["peru-68"] });

    const res = await request(app).patch(`/api/cart/items/${added.body.cart.lines[0].lineId}`).set(bearer(token)).send(body);

    expect(res.status).toBe(400);
  });

  it("refuses a line id that is not one of ours", async () => {
    const { app } = await build();
    const token = await tokenFor(userA);

    for (const lineId of ["abc", "p-123", "x-64b7f0c2a1b2c3d4e5f60a01", "%7B%22%24ne%22%3Anull%7D"]) {
      expect((await request(app).delete(`/api/cart/items/${lineId}`).set(bearer(token))).status, lineId).toBe(400);
    }
  });
});

describe("the price of a line", () => {
  it("stays when the product gets a new price, and the cart says so", async () => {
    const { app, ids, products } = await build();
    const token = await tokenFor(userA);
    await request(app).post("/api/cart/items").set(bearer(token)).send({ kind: "product", productId: ids["peru-68"] });
    await products.update(ids["peru-68"], { price: 2000 });

    const res = await request(app).get("/api/cart").set(bearer(token));

    expect(res.body.cart.subtotal).toBe(1100);
    expect(res.body.cart.lines[0]).toMatchObject({ unitPrice: 1100, priceChanged: true });
    expect(res.body.cart.lines[0].products[0].price).toBe(2000);
  });
});

describe("the language of the cart", () => {
  it("names the products in the language of the request", async () => {
    const { app, ids } = await build();
    const token = await tokenFor(userA);
    await request(app).post("/api/cart/items").set(bearer(token)).send({ kind: "product", productId: ids["peru-68"] });

    const es = await request(app).get("/api/cart?lang=es").set(bearer(token));
    const header = await request(app).get("/api/cart").set(bearer(token)).set("Accept-Language", "es");
    const en = await request(app).get("/api/cart").set(bearer(token));

    expect(es.body.cart.lines[0].products[0]).toMatchObject({ name: "Perú 68%", imageAlt: "Primer plano de una barra de chocolate oscuro con virutas finas" });
    expect(header.body.cart.lines[0].products[0].name).toBe("Perú 68%");
    expect(en.body.cart.lines[0].products[0].name).toBe("Peru 68%");
  });
});

describe("POST /api/cart/merge", () => {
  it("adds the cart of the visitor to the cart of the user, and takes the cookie away", async () => {
    const { app, ids } = await build();
    const token = await tokenFor(userA);
    const visitor = await request(app).post("/api/cart/items").send({ kind: "product", productId: ids["peru-68"], quantity: 2 });
    await request(app).post("/api/cart/items").set(bearer(token)).send({ kind: "product", productId: ids["peru-68"], quantity: 1 });
    await request(app).post("/api/cart/items").set(bearer(token)).send({ kind: "product", productId: ids["ecuador-72"], quantity: 1 });

    const res = await request(app).post("/api/cart/merge").set(bearer(token)).set("Cookie", cookieOf(visitor)!);

    expect(res.status).toBe(200);
    expect(res.body.cart.lines.map((line: { products: { slug: string }[]; quantity: number }) => [line.products[0].slug, line.quantity])).toEqual([
      ["peru-68", 3],
      ["ecuador-72", 1],
    ]);
    expect(cookieLine(res)).toMatch(/^sc_guest=;/);
    // the cart of the visitor is gone
    expect((await request(app).get("/api/cart").set("Cookie", cookieOf(visitor)!)).body.cart.lines).toEqual([]);
  });

  it("changes nothing when it is done again", async () => {
    const { app, ids } = await build();
    const token = await tokenFor(userA);
    const visitor = await request(app).post("/api/cart/items").send({ kind: "product", productId: ids["peru-68"], quantity: 2 });
    const first = await request(app).post("/api/cart/merge").set(bearer(token)).set("Cookie", cookieOf(visitor)!);

    const again = await request(app).post("/api/cart/merge").set(bearer(token)).set("Cookie", cookieOf(visitor)!);

    expect(again.body.cart.lines).toEqual(first.body.cart.lines);
  });

  it("gives the cart of the user when the visitor has no cart", async () => {
    const { app, ids } = await build();
    const token = await tokenFor(userA);
    await request(app).post("/api/cart/items").set(bearer(token)).send({ kind: "product", productId: ids["peru-68"] });

    const res = await request(app).post("/api/cart/merge").set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.cart.itemCount).toBe(1);
  });

  it("needs a signed in user", async () => {
    const { app, ids } = await build();
    const visitor = await request(app).post("/api/cart/items").send({ kind: "product", productId: ids["peru-68"] });

    const guest = await request(app).post("/api/cart/merge").set("Cookie", cookieOf(visitor)!);
    const expired = await request(app).post("/api/cart/merge").set(bearer(await signToken({ id: userA, role: "user" }, Math.floor(Date.now() / 1000) - 60)));

    expect([guest.status, guest.body.error.code]).toEqual([401, "UNAUTHENTICATED"]);
    expect([expired.status, expired.body.error.code]).toEqual([401, "TOKEN_EXPIRED"]);
    // and the cart of the visitor is still there
    expect((await request(app).get("/api/cart").set("Cookie", cookieOf(visitor)!)).body.cart.lines).toHaveLength(1);
  });

  it("cannot be used with the cookie of somebody else's cart, because the cookie is signed", async () => {
    const { app, ids } = await build();
    const token = await tokenFor(userA);
    const victim = await request(app).post("/api/cart/items").send({ kind: "product", productId: ids["peru-68"] });
    const id = decodeURIComponent(cookieOf(victim)!.slice("sc_guest=".length)).slice(2).split(".")[0];

    const res = await request(app).post("/api/cart/merge").set(bearer(token)).set("Cookie", `sc_guest=${encodeURIComponent(id)}`);

    expect(res.body.cart.lines).toEqual([]);
    expect((await request(app).get("/api/cart").set("Cookie", cookieOf(victim)!)).body.cart.lines).toHaveLength(1);
  });
});

describe("every answer of the cart", () => {
  it("is never kept by a cache, and has the standard error shape", async () => {
    const { app } = await build();

    const ok = await request(app).get("/api/cart");
    const failed = await request(app).post("/api/cart/items").send({});

    expect(ok.headers["cache-control"]).toBe("no-store");
    expect(failed.headers["cache-control"]).toBe("no-store");
    expect(Object.keys(failed.body.error).sort()).toEqual(["code", "details", "message"]);
  });
});
