import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/apiFetch";
import { apiProduct, featuredEnglish, jsonResponse, mockFeatured } from "../test/mockApi";
import { fetchFeaturedProducts } from "./products";

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
