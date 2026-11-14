import { describe, expect, it } from "vitest";
import { seedProducts } from "../seed/products.seed.ts";
import { createMemoryCartStore } from "../test/memoryCartStore.ts";
import { createMemoryProductStore } from "../test/memoryProductStore.ts";
import { createCartService, GUEST_CART_DAYS, lineIdFor } from "./cart.service.ts";
import type { CartStore } from "./cart.store.ts";
import type { AddItemInput } from "../schemas/cart.schema.ts";

const user = { userId: "64b7f0c2a1b2c3d4e5f60718" };
const otherUser = { userId: "64b7f0c2a1b2c3d4e5f60719" };
const guest = { guestId: "6f1d2c3b-4a59-4e8b-9c7d-0a1b2c3d4e5f" };

async function setup(options: { carts?: CartStore } = {}) {
  const products = createMemoryProductStore();
  const ids: Record<string, string> = {};
  for (const { product, quantity } of seedProducts) ids[product.slug] = (await products.create(product, quantity)).id;

  const carts = createMemoryCartStore();
  let current = new Date("2026-03-01T12:00:00.000Z");
  const service = createCartService({ carts: options.carts ?? carts, products, now: () => current });

  const one = (slug: string, quantity = 1): AddItemInput => ({ kind: "product", productId: ids[slug], quantity });
  const sampler = (...slugs: string[]): AddItemInput => ({ kind: "sampler", productIds: slugs.map((slug) => ids[slug]), quantity: 1 });
  return { service, products, carts, ids, one, sampler, now: () => current };
}

const fourBars = ["ecuador-72", "peru-68", "venezuela-76", "colombia-64"];

describe("an empty cart", () => {
  it("is what a visitor with no cart has, and what a user with none has", async () => {
    const { service } = await setup();

    for (const owner of [null, user, guest]) {
      expect(await service.get(owner, "en")).toEqual({ lines: [], itemCount: 0, subtotal: 0, updatedAt: null });
    }
  });
});

describe("adding a product", () => {
  it("makes a line with the price of the product, the stock and the name in the language", async () => {
    const { service, one } = await setup();

    const cart = await service.addItem(user, one("peru-68", 2), "es");

    expect(cart).toMatchObject({ itemCount: 2, subtotal: 2200 });
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]).toMatchObject({ kind: "product", quantity: 2, unitPrice: 1100, lineTotal: 2200, available: 60, issue: null, priceChanged: false });
    expect(cart.lines[0].products[0]).toMatchObject({ slug: "peru-68", name: "Perú 68%", price: 1100, stock: 60, availability: "in_stock" });
    expect(cart.lines[0].lineId).toMatch(/^p-[0-9a-f]{24}$/);
  });

  it("adds to the same line when the same product comes again", async () => {
    const { service, one } = await setup();
    await service.addItem(user, one("peru-68", 2), "en");

    const cart = await service.addItem(user, one("peru-68", 3), "en");

    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].quantity).toBe(5);
  });

  it("keeps the lines in the order they were made", async () => {
    const { service, one } = await setup();
    await service.addItem(user, one("peru-68"), "en");
    await service.addItem(user, one("ecuador-72"), "en");
    await service.addItem(user, one("peru-68"), "en");

    const cart = await service.addItem(user, one("colombia-64"), "en");

    expect(cart.lines.map((line) => line.products[0].slug)).toEqual(["peru-68", "ecuador-72", "colombia-64"]);
  });

  it("keeps the price of the day it was added, and says that the price has changed since", async () => {
    const { service, products, ids, one } = await setup();
    await service.addItem(user, one("peru-68"), "en");
    await products.update(ids["peru-68"], { price: 1900 });

    const again = await service.addItem(user, one("peru-68"), "en");

    expect(again.lines[0]).toMatchObject({ quantity: 2, unitPrice: 1100, lineTotal: 2200, priceChanged: true });
    expect(again.lines[0].products[0].price).toBe(1900);
    expect(again.subtotal).toBe(2200);
  });

  it("does not know a product that does not exist or is switched off", async () => {
    const { service, products, ids, one } = await setup();
    await products.update(ids["colombia-64"], { active: false });

    await expect(service.addItem(user, one("colombia-64"), "en")).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
    await expect(service.addItem(user, { kind: "product", productId: "64b7f0c2a1b2c3d4e5f607ff", quantity: 1 }, "en")).rejects.toMatchObject({ status: 404 });
  });
});

describe("the stock", () => {
  it("lets a line have as many units as there are, and says how many there can be when it is more", async () => {
    const { service, one } = await setup();
    await service.addItem(user, one("venezuela-76", 4), "en");

    const error = await service.addItem(user, one("venezuela-76", 3), "en").catch((failure) => failure);

    expect(error).toMatchObject({ status: 409, code: "INSUFFICIENT_STOCK" });
    expect(error.message).toBe("Only 6 left of Venezuela 76%.");
    expect(error.details).toEqual([{ field: "quantity", available: 6, message: "Only 6 left of Venezuela 76%." }]);
    // and nothing was added
    expect((await service.get(user, "en")).lines[0].quantity).toBe(4);
  });

  it("names the product in the language of the request", async () => {
    const { service, one } = await setup();

    const error = await service.addItem(user, one("venezuela-76", 7), "es").catch((failure) => failure);

    expect(error.message).toBe("Only 6 left of Venezuela 76%.");
    const sold = await service.addItem(user, one("fleur-de-sel-bar"), "es").catch((failure) => failure);
    expect(sold.message).toBe("Barra Flor de Sal is sold out.");
  });

  it("does not sell what is sold out, and says there are none", async () => {
    const { service, one } = await setup();

    const error = await service.addItem(user, one("fleur-de-sel-bar"), "en").catch((failure) => failure);

    expect(error).toMatchObject({ status: 409, code: "INSUFFICIENT_STOCK" });
    expect(error.details[0].available).toBe(0);
    expect((await service.get(user, "en")).lines).toEqual([]);
  });

  it("counts what the other lines take of the same product", async () => {
    const { service, one, sampler } = await setup();
    await service.addItem(user, one("venezuela-76", 4), "en");

    const error = await service.addItem(user, { ...sampler(...fourBars), quantity: 3 }, "en").catch((failure) => failure);

    // 6 Venezuela in stock, 4 are already taken by the single line
    expect(error).toMatchObject({ code: "INSUFFICIENT_STOCK" });
    expect(error.details[0].available).toBe(2);
    await expect(service.addItem(user, { ...sampler(...fourBars), quantity: 2 }, "en")).resolves.toBeDefined();
  });

  it("lets a line have at most 99 units, even when there is more in stock", async () => {
    const { service, one } = await setup();
    await service.addItem(user, one("ecuador-72", 99), "en");

    const error = await service.addItem(user, one("ecuador-72", 1), "en").catch((failure) => failure);

    expect(error).toMatchObject({ code: "INSUFFICIENT_STOCK" });
    expect(error.details[0].available).toBe(99);
  });

  it("looks at the stock of today, not of when the line was made", async () => {
    const { service, products, ids, one } = await setup();
    await service.addItem(user, one("peru-68", 5), "en");
    await products.setInventory(ids["peru-68"], { quantity: 6 });

    await expect(service.addItem(user, one("peru-68", 2), "en")).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    await expect(service.addItem(user, one("peru-68", 1), "en")).resolves.toBeDefined();
  });
});

describe("a sampler", () => {
  it("is one line with the products and the price of all of them", async () => {
    const { service, sampler } = await setup();

    const cart = await service.addItem(user, sampler(...fourBars), "en");

    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]).toMatchObject({ kind: "sampler", quantity: 1, unitPrice: 1200 + 1100 + 1500 + 1000, available: 6 });
    expect(cart.lines[0].lineId).toMatch(/^s-[0-9a-f]{20}$/);
    expect(cart.lines[0].products.map((product) => product.slug).sort()).toEqual([...fourBars].sort());
  });

  it("is the same line whatever the order of the products, so the same sampler adds up", async () => {
    const { service, sampler } = await setup();
    await service.addItem(user, sampler("ecuador-72", "peru-68", "venezuela-76", "colombia-64"), "en");

    const cart = await service.addItem(user, sampler("colombia-64", "venezuela-76", "peru-68", "ecuador-72"), "en");

    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].quantity).toBe(2);
  });

  it("is another line when one of the products is different", async () => {
    const { service, sampler } = await setup();
    await service.addItem(user, sampler(...fourBars), "en");

    const cart = await service.addItem(user, sampler("ecuador-72", "peru-68", "venezuela-76", "madagascar-80"), "en");

    expect(cart.lines).toHaveLength(2);
  });

  it("cannot be made with a product that is sold out", async () => {
    const { service, sampler } = await setup();

    await expect(service.addItem(user, sampler("ecuador-72", "peru-68", "venezuela-76", "fleur-de-sel-bar"), "en")).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
  });

  it("takes one of each product for each unit, so the product with the least stock decides", async () => {
    const { service, sampler } = await setup();

    const error = await service.addItem(user, { ...sampler(...fourBars), quantity: 7 }, "en").catch((failure) => failure);

    expect(error.details[0].available).toBe(6);
    expect(error.message).toContain("Venezuela");
  });
});

describe("lineIdFor", () => {
  it("is the same for the same things in any order, and different for different things", () => {
    const a = "64b7f0c2a1b2c3d4e5f60a01";
    const b = "64b7f0c2a1b2c3d4e5f60a02";
    const c = "64b7f0c2a1b2c3d4e5f60a03";
    const d = "64b7f0c2a1b2c3d4e5f60a04";

    expect(lineIdFor("product", [a])).toBe(`p-${a}`);
    expect(lineIdFor("sampler", [a, b, c, d])).toBe(lineIdFor("sampler", [d, c, b, a]));
    expect(lineIdFor("sampler", [a, b, c, d])).not.toBe(lineIdFor("sampler", [a, b, c, a.replace("01", "09")]));
  });
});

describe("the number of lines", () => {
  it("is at most 30, and says so, but a line that is already there can still grow", async () => {
    const { service, products, one } = await setup();
    const extra: string[] = [];
    for (let index = 0; index < 30; index++) {
      const base = structuredClone(seedProducts[0].product);
      const made = await products.create({ ...base, slug: `extra-${index}`, sku: `SC-EX-${index}` }, 5);
      extra.push(made.id);
    }
    for (const id of extra) await service.addItem(user, { kind: "product", productId: id, quantity: 1 }, "en");

    await expect(service.addItem(user, one("peru-68"), "en")).rejects.toMatchObject({ status: 409, code: "CART_FULL" });
    await expect(service.addItem(user, { kind: "product", productId: extra[0], quantity: 1 }, "en")).resolves.toBeDefined();
  });
});

describe("changing and taking away", () => {
  it("sets the quantity of a line, down or up", async () => {
    const { service, one } = await setup();
    const { lines } = await service.addItem(user, one("peru-68", 3), "en");

    expect((await service.setQuantity(user, lines[0].lineId, 8, "en")).lines[0].quantity).toBe(8);
    expect((await service.setQuantity(user, lines[0].lineId, 1, "en")).lines[0].quantity).toBe(1);
  });

  it("refuses a quantity that the stock cannot cover, and keeps the old one", async () => {
    const { service, one } = await setup();
    const { lines } = await service.addItem(user, one("venezuela-76", 2), "en");

    await expect(service.setQuantity(user, lines[0].lineId, 7, "en")).rejects.toMatchObject({ status: 409, code: "INSUFFICIENT_STOCK" });

    expect((await service.get(user, "en")).lines[0].quantity).toBe(2);
  });

  it("says that a line that is not in the cart was not found", async () => {
    const { service, ids, one } = await setup();
    await service.addItem(user, one("peru-68"), "en");
    const missing = `p-${ids["ecuador-72"]}`;

    await expect(service.setQuantity(user, missing, 2, "en")).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
    await expect(service.removeItem(user, missing, "en")).rejects.toMatchObject({ status: 404 });
  });

  it("takes a line out, and empties the cart", async () => {
    const { service, one } = await setup();
    await service.addItem(user, one("peru-68"), "en");
    const { lines } = await service.addItem(user, one("ecuador-72"), "en");

    const after = await service.removeItem(user, lines[1].lineId, "en");
    expect(after.lines.map((line) => line.products[0].slug)).toEqual(["peru-68"]);

    expect(await service.clear(user, "en")).toEqual({ lines: [], itemCount: 0, subtotal: 0, updatedAt: null });
    expect((await service.get(user, "en")).lines).toEqual([]);
  });

  it("keeps the carts of different owners apart, so a line of somebody else is not found", async () => {
    const { service, one } = await setup();
    const mine = await service.addItem(user, one("peru-68", 2), "en");
    await service.addItem(otherUser, one("ecuador-72"), "en");

    await expect(service.setQuantity(otherUser, mine.lines[0].lineId, 5, "en")).rejects.toMatchObject({ status: 404 });
    expect((await service.get(user, "en")).lines).toHaveLength(1);
    expect((await service.get(otherUser, "en")).lines[0].products[0].slug).toBe("ecuador-72");
  });
});

describe("what is wrong with a line", () => {
  it("says over_stock and how many there can be, when the stock fell under the quantity", async () => {
    const { service, products, ids, one } = await setup();
    await service.addItem(user, one("peru-68", 10), "en");
    await products.setInventory(ids["peru-68"], { quantity: 4 });

    const { lines } = await service.get(user, "en");

    expect(lines[0]).toMatchObject({ issue: "over_stock", available: 4, quantity: 10 });
  });

  it("says out_of_stock when there are none left", async () => {
    const { service, products, ids, one } = await setup();
    await service.addItem(user, one("peru-68", 2), "en");
    await products.setInventory(ids["peru-68"], { quantity: 0 });

    expect((await service.get(user, "en")).lines[0]).toMatchObject({ issue: "out_of_stock", available: 0 });
  });

  it("says unavailable when a product was switched off, and keeps the line so the person can see it", async () => {
    const { service, products, ids, one } = await setup();
    await service.addItem(user, one("peru-68", 2), "en");
    await products.update(ids["peru-68"], { active: false });

    const { lines, subtotal } = await service.get(user, "en");

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ issue: "unavailable", available: 0 });
    expect(subtotal).toBe(2200);
  });

  it("says nothing is wrong when nothing is", async () => {
    const { service, one } = await setup();
    await service.addItem(user, one("peru-68"), "en");

    expect((await service.get(user, "en")).lines[0].issue).toBeNull();
  });
});

describe("carts of visitors", () => {
  it("expire 30 days after the last change, and the carts of users never do", async () => {
    const { service, carts, one, now } = await setup();

    await service.addItem(guest, one("peru-68"), "en");
    await service.addItem(user, one("peru-68"), "en");

    const records = carts.all();
    expect(records.find((record) => record.key.startsWith("guest:"))?.expiresAt?.getTime()).toBe(now().getTime() + GUEST_CART_DAYS * 24 * 60 * 60 * 1000);
    expect(records.find((record) => record.key.startsWith("user:"))?.expiresAt).toBeUndefined();
  });
});

describe("merging the cart of a visitor into the cart of a user", () => {
  it("adds the lines, adds the quantities of the same item, and removes the cart of the visitor", async () => {
    const { service, carts, one } = await setup();
    await service.addItem(guest, one("peru-68", 2), "en");
    await service.addItem(guest, one("colombia-64", 1), "en");
    await service.addItem(user, one("peru-68", 3), "en");
    await service.addItem(user, one("ecuador-72", 1), "en");

    const cart = await service.merge(user.userId, guest.guestId, "en");

    expect(cart.lines.map((line) => [line.products[0].slug, line.quantity])).toEqual([
      ["peru-68", 5],
      ["ecuador-72", 1],
      ["colombia-64", 1],
    ]);
    expect(await carts.find(guest)).toBeNull();
  });

  it("keeps the price that was already in the cart of the user, and the price of a line that comes in", async () => {
    const { service, products, ids, one } = await setup();
    await service.addItem(guest, one("peru-68", 1), "en");
    await service.addItem(guest, one("colombia-64", 1), "en");
    await products.update(ids["peru-68"], { price: 1500 });
    await service.addItem(user, one("peru-68", 1), "en");
    await products.update(ids["peru-68"], { price: 1900 });

    const cart = await service.merge(user.userId, guest.guestId, "en");

    expect(cart.lines.find((line) => line.products[0].slug === "peru-68")?.unitPrice).toBe(1500);
    expect(cart.lines.find((line) => line.products[0].slug === "colombia-64")?.unitPrice).toBe(1000);
  });

  it("does the whole thing again for a user with an empty cart", async () => {
    const { service, sampler } = await setup();
    await service.addItem(guest, sampler(...fourBars), "en");

    const cart = await service.merge(user.userId, guest.guestId, "en");

    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].kind).toBe("sampler");
  });

  it("keeps every line, with the units the stock can cover, and at least one", async () => {
    const { service, products, ids, one } = await setup();
    await service.addItem(guest, one("venezuela-76", 5), "en");
    await service.addItem(guest, one("peru-68", 3), "en");
    await service.addItem(user, one("venezuela-76", 4), "en");
    await products.setInventory(ids["peru-68"], { quantity: 0 });

    const cart = await service.merge(user.userId, guest.guestId, "en");

    const venezuela = cart.lines.find((line) => line.products[0].slug === "venezuela-76");
    const peru = cart.lines.find((line) => line.products[0].slug === "peru-68");
    // 9 asked for, 6 in stock
    expect(venezuela).toMatchObject({ quantity: 6, issue: null });
    // sold out: the line stays, marked, with one unit
    expect(peru).toMatchObject({ quantity: 1, issue: "out_of_stock" });
  });

  it("changes nothing when it is done again, and when the visitor had no cart", async () => {
    const { service, one } = await setup();
    await service.addItem(guest, one("peru-68", 2), "en");
    const first = await service.merge(user.userId, guest.guestId, "en");

    const again = await service.merge(user.userId, guest.guestId, "en");
    const stranger = await service.merge(user.userId, "00000000-0000-4000-8000-000000000000", "en");

    expect(again.lines).toEqual(first.lines);
    expect(stranger.lines).toEqual(first.lines);
  });

  it("does not lose a line of the visitor to the limit of 99 units", async () => {
    const { service, one } = await setup();
    await service.addItem(guest, one("ecuador-72", 80), "en");
    await service.addItem(user, one("ecuador-72", 60), "en");

    const cart = await service.merge(user.userId, guest.guestId, "en");

    // 140 asked for, 99 at most
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].quantity).toBe(99);
  });
});

describe("two changes at the same moment", () => {
  it("are both kept", async () => {
    const { service, one } = await setup();

    await Promise.all([service.addItem(user, one("peru-68", 1), "en"), service.addItem(user, one("peru-68", 1), "en"), service.addItem(user, one("ecuador-72", 1), "en")]);

    const cart = await service.get(user, "en");
    expect(cart.lines.find((line) => line.products[0].slug === "peru-68")?.quantity).toBe(2);
    expect(cart.lines.find((line) => line.products[0].slug === "ecuador-72")?.quantity).toBe(1);
  });

  it("cannot sell the last unit twice", async () => {
    const { service, products, ids, one } = await setup();
    await products.setInventory(ids["peru-68"], { quantity: 1 });

    const results = await Promise.allSettled([service.addItem(user, one("peru-68"), "en"), service.addItem(user, one("peru-68"), "en")]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await service.get(user, "en")).lines[0].quantity).toBe(1);
  });

  it("gives up with a clear answer when the cart keeps being changed by somebody else", async () => {
    const busy: CartStore = { find: async () => null, save: async () => null, remove: async () => {} };
    const { service, one } = await setup({ carts: busy });

    await expect(service.addItem(user, one("peru-68"), "en")).rejects.toMatchObject({ status: 409, code: "CART_BUSY" });
  });
});
