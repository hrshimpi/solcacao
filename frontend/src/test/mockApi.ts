// Test helpers for pages that call the API: pick what the next calls to fetch answer.
import { vi } from "vitest";

// five products as the API sends them: prices in cents, text in the language that was asked for
export function apiProduct(slug: string, name: string, extra: Record<string, unknown> = {}) {
  return {
    id: `id-${slug}`,
    slug,
    name,
    caption: `${name}, caption`,
    tastingSummary: `flavor of ${name}`,
    price: 1250,
    images: [`https://images.example.com/${slug}.jpg`],
    ...extra,
  };
}

export const featuredEnglish = [
  apiProduct("ecuador-72", "Ecuador 72%", { price: 1200 }),
  apiProduct("peru-68", "Peru 68%", { price: 1100 }),
  apiProduct("venezuela-76", "Venezuela 76%", { price: 1500 }),
  apiProduct("colombia-64", "Colombia 64%", { price: 1000 }),
  apiProduct("madagascar-80", "Madagascar 80%", { price: 1400 }),
];

export const featuredSpanish = featuredEnglish.map((product) =>
  apiProduct(product.slug, product.name.replace("Peru", "Perú"), { price: product.price, tastingSummary: `sabor de ${product.name}` }),
);

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// the featured request answers with these items for English and Spanish, everything else gets a 404
export function mockFeatured(items: { en?: unknown[]; es?: unknown[] } = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (!url.startsWith("/api/products?featured=true")) return jsonResponse({ error: { code: "NOT_FOUND" } }, 404);
    const language = new Headers(init?.headers).get("Accept-Language");
    return jsonResponse({ items: language === "es" ? (items.es ?? featuredSpanish) : (items.en ?? featuredEnglish), page: 1, limit: 5, total: 5 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// the featured request fails in the way you choose, everything else gets a 404
export function mockFeaturedFailure(failure: "server-error" | "network" | "not-json" | "wrong-shape") {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    if (!String(input).startsWith("/api/products?featured=true")) return jsonResponse({ error: { code: "NOT_FOUND" } }, 404);
    if (failure === "network") throw new TypeError("Failed to fetch");
    if (failure === "server-error") return jsonResponse({ error: { code: "INTERNAL_ERROR" } }, 500);
    if (failure === "not-json") return new Response("<!doctype html><html></html>", { status: 200, headers: { "Content-Type": "text/html" } });
    return jsonResponse({ products: "nope" });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// the featured request never answers (until the test lets it), to look at the loading state
export function mockFeaturedPending() {
  let release: (response: Response) => void = () => {};
  const fetchMock = vi.fn(
    (input: RequestInfo | URL) =>
      new Promise<Response>((resolve) => {
        if (String(input).startsWith("/api/products?featured=true")) release = resolve;
        else resolve(jsonResponse({}, 404));
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, answer: (items: unknown[]) => release(jsonResponse({ items })) };
}
