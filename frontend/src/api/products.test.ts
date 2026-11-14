import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/apiFetch";
import { installFakeServer } from "../test/fakeServer";
import { apiProduct, featuredEnglish, jsonResponse, mockFeatured } from "../test/mockApi";
import { fixtureRecords, wireProduct } from "../test/productFixtures";
import { fetchFeaturedProducts, fetchProducts, toProduct } from "./products";

function answerWith(body: unknown, status = 200) {
  vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(body, status)));
}

describe("fetchFeaturedProducts: the request", () => {
  it("asks for five featured products in the current language", async () => {
    const fetchMock = mockFeatured();

    await fetchFeaturedProducts("es");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/products?featured=true&limit=5");
    expect(new Headers(init.headers).get("Accept-Language")).toBe("es");
  });
});

describe("fetchFeaturedProducts: what comes back", () => {
  it("turns the API products into what the home page shows", async () => {
    mockFeatured({ en: [apiProduct("ecuador-72", "Ecuador 72%", { price: 1250, tastingSummary: "bright berry", imageAlt: "A stack of bars" })] });

    expect(await fetchFeaturedProducts("en")).toEqual([
      {
        id: "id-ecuador-72",
        slug: "ecuador-72",
        name: "Ecuador 72%",
        flavor: "bright berry",
        price: 12.5,
        image: "https://images.example.com/ecuador-72.jpg",
        imageAlt: "A stack of bars",
      },
    ]);
  });

  it("keeps the order of the API", async () => {
    mockFeatured();

    const products = await fetchFeaturedProducts("en");

    expect(products.map((product) => product.slug)).toEqual(featuredEnglish.map((product) => product.slug));
  });

  it("uses the caption when there is no tasting summary", async () => {
    answerWith({ items: [apiProduct("a-bar", "A Bar", { tastingSummary: undefined, caption: "Peru, 68% cacao" })] });

    expect((await fetchFeaturedProducts("en"))[0].flavor).toBe("Peru, 68% cacao");
  });

  it("works with no price, no flavor and no alt text", async () => {
    answerWith({ items: [{ slug: "a-bar", name: "A Bar" }] });

    expect(await fetchFeaturedProducts("en")).toEqual([{ id: "a-bar", slug: "a-bar", name: "A Bar", flavor: "", price: null, image: "", imageAlt: "" }]);
  });

  it("takes a single image field when there is no images list", async () => {
    answerWith({ items: [{ slug: "a-bar", name: "A Bar", image: "/photos/a-bar.jpg" }] });

    expect((await fetchFeaturedProducts("en"))[0].image).toBe("/photos/a-bar.jpg");
  });

  it("treats a price that makes no sense as no price", async () => {
    answerWith({ items: [apiProduct("a", "A", { price: -5 }), apiProduct("b", "B", { price: "12" }), apiProduct("c", "C", { price: null }), apiProduct("d", "D", { price: 0 })] });

    expect((await fetchFeaturedProducts("en")).map((product) => product.price)).toEqual([null, null, null, 0]);
  });

  it("accepts a plain list as well as { items }", async () => {
    answerWith([apiProduct("a-bar", "A Bar")]);

    expect(await fetchFeaturedProducts("en")).toHaveLength(1);
  });

  it("shows at most five, even if the server sends more", async () => {
    answerWith({ items: Array.from({ length: 8 }, (_, i) => apiProduct(`bar-${i}`, `Bar ${i}`)) });

    expect(await fetchFeaturedProducts("en")).toHaveLength(5);
  });

  it("returns an empty list when there are no featured products", async () => {
    answerWith({ items: [], page: 1, limit: 5, total: 0 });

    expect(await fetchFeaturedProducts("en")).toEqual([]);
  });
});

describe("fetchFeaturedProducts: things that are left out", () => {
  it("skips products that are broken and keeps the good ones", async () => {
    answerWith({
      items: [
        null,
        "a string",
        42,
        {},
        { slug: "no-name" },
        { name: "No slug" },
        { slug: "", name: "Empty slug" },
        { slug: "../etc/passwd", name: "Path in the slug" },
        { slug: "has space", name: "Space in the slug" },
        { slug: "javascript:alert(1)", name: "Script in the slug" },
        apiProduct("good-bar", "Good Bar"),
      ],
    });

    expect((await fetchFeaturedProducts("en")).map((product) => product.slug)).toEqual(["good-bar"]);
  });

  it("drops an image address that is not a web address or a path on the site", async () => {
    answerWith({
      items: [
        apiProduct("a", "A", { images: ["javascript:alert(1)"] }),
        apiProduct("b", "B", { images: ["data:text/html,<script>alert(1)</script>"] }),
        apiProduct("c", "C", { images: ['https://x.example/a.jpg" onerror="alert(1)'] }),
        apiProduct("d", "D", { images: ["https://x.example/d.jpg"] }),
        apiProduct("e", "E", { images: ["/photos/e.jpg"] }),
      ],
    });

    expect((await fetchFeaturedProducts("en")).map((product) => product.image)).toEqual(["", "", "", "https://x.example/d.jpg", "/photos/e.jpg"]);
  });
});

describe("fetchFeaturedProducts: when it fails", () => {
  it.each([
    ["an object without a list", { products: [] }],
    ["null", null],
    ["a string", "hello"],
    ["items that is not a list", { items: "none" }],
  ])("throws an ApiError for %s", async (_label, body) => {
    answerWith(body);

    await expect(fetchFeaturedProducts("en")).rejects.toBeInstanceOf(ApiError);
  });

  it("throws an ApiError when the server answers with an error", async () => {
    answerWith({ error: { code: "INTERNAL_ERROR" } }, 500);

    await expect(fetchFeaturedProducts("en")).rejects.toMatchObject({ name: "ApiError", status: 500 });
  });

  it("throws an ApiError when the server cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(fetchFeaturedProducts("en")).rejects.toMatchObject({ name: "ApiError", status: 0 });
  });
});

// a product as the API sends it
const wire = () => wireProduct(fixtureRecords[0], "en");

describe("toProduct", () => {
  it("turns a product of the API into the one the shop shows: the price in dollars, the pictures and the origin", () => {
    const product = toProduct(wire())!;

    expect(product).toMatchObject({ slug: "ecuador-72", name: "Ecuador 72%", origin: "ecuador", originName: "Ecuador", percentage: 72, category: "bar", stock: 120 });
    expect(product.price).toBe(fixtureRecords[0].product.price / 100);
    expect(product.images.length).toBeGreaterThan(0);
    expect(product.image).toBe(fixtureRecords[0].product.thumbnail);
    expect(product.imageLarge).toBe(product.images[0]);
  });

  it("refuses what is not a product, or has a slug that could not go into a link", () => {
    for (const raw of [null, undefined, "bar", 4, [], {}, { ...wire(), slug: "../admin" }, { ...wire(), slug: "a b" }, { ...wire(), name: "  " }, { ...wire(), id: "" }]) {
      expect(toProduct(raw), JSON.stringify(raw)).toBeNull();
    }
  });

  it("refuses a product with a category, price, percentage or stock that makes no sense", () => {
    for (const change of [{ category: "cake" }, { price: -1 }, { price: "12" }, { price: Number.NaN }, { percentage: "72" }, { stock: -1 }, { stock: 1.5 }, { stock: "3" }]) {
      expect(toProduct({ ...wire(), ...change }), JSON.stringify(change)).toBeNull();
    }
  });

  it("leaves out the pictures that are not web addresses, and the notes that are not known", () => {
    const product = toProduct({ ...wire(), images: ["javascript:alert(1)", "data:text/html,x", "https://images.example.com/a.jpg", "/local.jpg", 4], thumbnail: "javascript:alert(1)", notes: ["fruity", "spicy", 3] })!;

    expect(product.images).toEqual(["https://images.example.com/a.jpg", "/local.jpg"]);
    expect(product.image).toBe("https://images.example.com/a.jpg");
    expect(product.notes).toEqual(["fruity"]);
  });

  it("has no pictures when the product has none, and keeps the months only when they have the shape of a month", () => {
    const product = toProduct({ ...wire(), images: undefined, thumbnail: "", harvestMonth: "2024-09", roastMonth: "next week" })!;

    expect(product.images).toEqual([]);
    expect(product.image).toBe("");
    expect(product.harvestMonth).toBe("2024-09");
    expect(product.roastMonth).toBe("");
  });

  it("uses the id of the origin when the server sends no name for it", () => {
    expect(toProduct({ ...wire(), originName: "" })!.originName).toBe("ecuador");
  });
});

describe("fetchProducts", () => {
  it("asks for the whole shop in the language of the page, and gives the products in the order of the server", async () => {
    const server = installFakeServer();

    const products = await fetchProducts("es");

    expect(products).toHaveLength(7);
    expect(products.find((product) => product.slug === "peru-68")?.name).toBe("Perú 68%");
    const [call] = server.callsTo("GET", "/api/products?limit=48&sort=featured");
    expect(call.headers["accept-language"]).toBe("es");
  });

  it("leaves out the products that are not valid, and keeps the others", async () => {
    answerWith({ items: [wire(), { id: "x" }, null, { ...wire(), slug: "no way" }], page: 1, limit: 48, total: 4 });

    expect((await fetchProducts("en")).map((product) => product.slug)).toEqual(["ecuador-72"]);
  });

  it.each([[{}], [{ items: "none" }], [null], ["text"]])("refuses an answer that is not a list (%j)", async (body) => {
    answerWith(body);

    await expect(fetchProducts("en")).rejects.toBeInstanceOf(ApiError);
  });

  it("fails with an ApiError when the server cannot be reached or answers with an error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    await expect(fetchProducts("en")).rejects.toMatchObject({ status: 0 });

    answerWith({ error: { code: "INTERNAL_ERROR", message: "Down.", details: [] } }, 500);
    await expect(fetchProducts("en")).rejects.toMatchObject({ status: 500, code: "INTERNAL_ERROR" });
  });
});

