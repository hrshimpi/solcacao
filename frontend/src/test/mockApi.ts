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

// ---------- the quote requests of a business account ----------

// a quote request as the API sends it
export function apiRequest(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    userId: "66a1b2c3d4e5f60718290000",
    companyName: "Hacienda Brands",
    contactName: "Isabel Vasquez",
    cacaoProfile: "Ecuador 72%",
    packagingType: "rigid_box",
    quantityEstimate: 800,
    notes: "",
    brandAssets: [],
    status: "submitted",
    quoteAmount: null,
    createdAt: "2026-10-26T12:00:00.000Z",
    updatedAt: "2026-10-26T12:00:00.000Z",
    ...extra,
  };
}

export function apiAsset(storedName: string, originalName: string, extra: Record<string, unknown> = {}) {
  return { originalName, storedName, mimeType: "application/pdf", sizeBytes: 2048, uploadedAt: "2026-10-26T12:00:00.000Z", ...extra };
}

// The server of the quote requests. Change its fields between calls to play an admin changing a request.
//   items         what the list answers with
//   total         the total the list says (the number of items when left out)
//   list          set to answer the list in another way (an error, or a wrong shape)
//   file          set to answer a file download in another way
//   fileContent   what a file contains
//   calls         every call that was made, with its address and headers
export function mockRequestsApi(items: unknown[] = []) {
  const server = {
    items,
    total: undefined as number | undefined,
    list: undefined as (() => Response | Promise<Response>) | undefined,
    file: undefined as (() => Response | Promise<Response>) | undefined,
    fileContent: "%PDF-1.4 file",
    calls: [] as { url: string; headers: Record<string, string> }[],
    fetchMock: undefined as unknown as ReturnType<typeof vi.fn>,
  };

  server.fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    server.calls.push({ url, headers: { ...(init?.headers as Record<string, string> | undefined) } });
    const { pathname } = new URL(url, "http://localhost");

    if (pathname === "/api/b2b/requests") {
      if (server.list) return server.list();
      return jsonResponse({ items: server.items, page: 1, limit: 100, total: server.total ?? server.items.length, totalPages: 1 });
    }
    if (/^\/api\/b2b\/requests\/[^/]+\/assets\/[^/]+$/.test(pathname)) {
      if (server.file) return server.file();
      return new Response(server.fileContent, { status: 200, headers: { "Content-Type": "application/pdf" } });
    }
    return jsonResponse({ error: { code: "NOT_FOUND", message: "Not found.", details: [] } }, 404);
  });
  vi.stubGlobal("fetch", server.fetchMock);
  return server;
}

export function errorResponse(status: number, code: string, message: string) {
  return jsonResponse({ error: { code, message, details: [] } }, status);
}
