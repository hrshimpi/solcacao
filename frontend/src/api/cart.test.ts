import { ApiError } from "../lib/apiFetch";
import { installFakeServer } from "../test/fakeServer";
import { fixtureId } from "../test/productFixtures";
import { addToCart, fetchCart, mergeCart, readCart, removeLine, setLineQuantity } from "./cart";

const productId = fixtureId("ecuador-72");
const lineId = `p-${productId}`;

// a line as the server sends it (prices in cents)
function wireLine(extra: Record<string, unknown> = {}) {
  return {
    lineId,
    kind: "product",
    quantity: 2,
    unitPrice: 1250,
    lineTotal: 2500,
    available: 10,
    issue: null,
    priceChanged: false,
    products: [{ id: productId, slug: "ecuador-72", name: "Ecuador 72%", thumbnail: "https://images.example.com/a.jpg", imageAlt: "A bar", price: 1250, stock: 10, availability: "in_stock" }],
    ...extra,
  };
}

describe("reading a cart", () => {
  it("turns cents into dollars, and works out the number of units", () => {
    const cart = readCart({ cart: { lines: [wireLine()], itemCount: 2, subtotal: 2500, updatedAt: null } });

    expect(cart.subtotal).toBe(25);
    expect(cart.itemCount).toBe(2);
    expect(cart.lines[0]).toMatchObject({ id: lineId, kind: "product", quantity: 2, unitPrice: 12.5, lineTotal: 25, available: 10, issue: null });
    expect(cart.lines[0].products[0]).toMatchObject({ id: productId, name: "Ecuador 72%", price: 12.5, stock: 10 });
  });

  it("keeps the issue of a line that cannot be bought as it is", () => {
    const cart = readCart({ cart: { lines: [wireLine({ issue: "out_of_stock", available: 0 })], itemCount: 2, subtotal: 2500 } });

    expect(cart.lines[0].issue).toBe("out_of_stock");
  });

  it("leaves out a line that is not valid, and adds up the lines that are", () => {
    const cart = readCart({
      cart: { lines: [wireLine(), wireLine({ lineId: "p-nope" }), wireLine({ quantity: 0 }), wireLine({ unitPrice: "12" }), "line", null], itemCount: 99, subtotal: 99999 },
    });

    expect(cart.lines).toHaveLength(1);
    expect(cart.itemCount).toBe(2);
    expect(cart.subtotal).toBe(25);
  });

  it("leaves out a product that is not valid, and keeps the line", () => {
    const cart = readCart({ cart: { lines: [wireLine({ products: [{ id: "", slug: "x" }, null, 4] })], itemCount: 2, subtotal: 2500 } });

    expect(cart.lines[0].products).toEqual([]);
  });

  it.each([[undefined], [null], ["cart"], [{}], [{ cart: null }], [{ cart: { lines: "none" } }]])("refuses an answer that is not a cart (%j)", (body) => {
    expect(() => readCart(body)).toThrow(ApiError);
  });
});

describe("the calls", () => {
  it("asks for the cart in the language of the page", async () => {
    const server = installFakeServer();

    const cart = await fetchCart({ lang: "es" });

    expect(cart.lines).toEqual([]);
    expect(server.callsTo("GET", "/api/cart")[0].headers["accept-language"]).toBe("es");
  });

  it("adds a product, changes its quantity, and removes it", async () => {
    const server = installFakeServer();

    const added = await addToCart({ kind: "product", productId, quantity: 2 }, { lang: "en" });
    expect(added.lines[0]).toMatchObject({ id: lineId, quantity: 2 });

    const changed = await setLineQuantity(lineId, 5, { lang: "en" });
    expect(changed.lines[0].quantity).toBe(5);
    expect(server.callsTo("PATCH", `/api/cart/items/${lineId}`)[0].body).toEqual({ quantity: 5 });

    const removed = await removeLine(lineId, { lang: "en" });
    expect(removed.lines).toEqual([]);
  });

  it("says why the stock does not allow a quantity, with the number that there is", async () => {
    const server = installFakeServer();
    server.setStock("ecuador-72", 3);

    const failure = await addToCart({ kind: "product", productId, quantity: 5 }, { lang: "en" }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).code).toBe("INSUFFICIENT_STOCK");
    expect((failure as ApiError).details[0].available).toBe(3);
  });

  it("asks the server to add the cart of the visitor, which only a signed in person can do", async () => {
    installFakeServer();

    const failure = await mergeCart({ lang: "en" }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(401);
  });
});
