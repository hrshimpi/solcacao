import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { LanguageProvider, useLang } from "../../i18n/LanguageContext";
import { installFakeServer } from "../../test/fakeServer";
import { fixtureId, productsFor } from "../../test/productFixtures";
import { ProductsProvider, originsOf, useProducts } from "./ProductsContext";

function wrapperAt(path: string) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[path]}>
      <LanguageProvider>
        <ProductsProvider>{children}</ProductsProvider>
      </LanguageProvider>
    </MemoryRouter>
  );
}

const failing = () => new Response(JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Down.", details: [] } }), { status: 500 });

describe("the products of the shop", () => {
  it("are loading until the server has answered, and then they are all there", async () => {
    installFakeServer();
    const { result } = renderHook(() => useProducts(), { wrapper: wrapperAt("/en") });

    expect(result.current.status).toBe("loading");
    expect(result.current.products).toEqual([]);

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.products).toHaveLength(7);
    expect(result.current.bySlug("peru-68")?.name).toBe("Peru 68%");
    expect(result.current.byId(fixtureId("peru-68"))?.slug).toBe("peru-68");
  });

  it("find a product by a slug in capitals too, and nothing for a slug the shop does not have", async () => {
    installFakeServer();
    const { result } = renderHook(() => useProducts(), { wrapper: wrapperAt("/en") });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.bySlug("PERU-68")?.slug).toBe("peru-68");
    expect(result.current.bySlug("no-such-bar")).toBeUndefined();
    expect(result.current.bySlug(undefined)).toBeUndefined();
    expect(result.current.byId("nope")).toBeUndefined();
  });

  it("ask for the language of the page", async () => {
    const server = installFakeServer();
    const { result } = renderHook(() => useProducts(), { wrapper: wrapperAt("/es") });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(server.callsTo("GET", "/api/products?limit=48&sort=featured")[0].headers["accept-language"]).toBe("es");
    expect(result.current.bySlug("peru-68")?.name).toBe("Perú 68%");
  });

  it("are asked for again in the new language when the language changes, and are never shown in the old one meanwhile", async () => {
    installFakeServer();
    const { result } = renderHook(() => ({ shop: useProducts(), language: useLang() }), { wrapper: wrapperAt("/en") });
    await waitFor(() => expect(result.current.shop.status).toBe("ready"));

    act(() => result.current.language.switchTo("es"));

    expect(result.current.shop.status).toBe("loading");
    expect(result.current.shop.products).toEqual([]);
    await waitFor(() => expect(result.current.shop.status).toBe("ready"));
    expect(result.current.shop.bySlug("peru-68")?.name).toBe("Perú 68%");
  });

  it("say that they could not be loaded, and load when asked again", async () => {
    const server = installFakeServer();
    server.override = failing;
    const { result } = renderHook(() => useProducts(), { wrapper: wrapperAt("/en") });
    await waitFor(() => expect(result.current.status).toBe("failed"));
    expect(result.current.products).toEqual([]);

    server.override = null;
    act(() => result.current.reload());

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.products).toHaveLength(7);
  });

  it("say that they could not be loaded when the server cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    const { result } = renderHook(() => useProducts(), { wrapper: wrapperAt("/en") });

    await waitFor(() => expect(result.current.status).toBe("failed"));
  });

  it("leave out the products of the server that are broken, and keep the others", async () => {
    const server = installFakeServer();
    server.override = (call) =>
      call.path.startsWith("/api/products")
        ? new Response(JSON.stringify({ items: [{ id: "x" }, null, "product"], page: 1, limit: 48, total: 3 }), { status: 200 })
        : undefined;
    const { result } = renderHook(() => useProducts(), { wrapper: wrapperAt("/en") });

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.products).toEqual([]);
  });

  it("complain when they are asked for outside the provider", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useProducts())).toThrow(/ProductsProvider/);

    quiet.mockRestore();
  });
});

describe("the origins of the products", () => {
  it("are the countries of the products, each once", async () => {
    installFakeServer();
    const { result } = renderHook(() => useProducts(), { wrapper: wrapperAt("/en") });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.origins.map((origin) => origin.id).sort()).toEqual(["colombia", "ecuador", "madagascar", "peru", "venezuela"]);
  });

  it("come in the order in which the countries first appear in the products", () => {
    const [ecuador, peru] = productsFor("en");
    const another = { ...ecuador, id: "another", slug: "another" };

    expect(originsOf([peru, ecuador, another]).map((origin) => origin.id)).toEqual(["peru", "ecuador"]);
    expect(originsOf([])).toEqual([]);
  });

  it("have the name of the country in the language of the page", async () => {
    installFakeServer();
    const { result } = renderHook(() => useProducts(), { wrapper: wrapperAt("/es") });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.origins.find((origin) => origin.id === "peru")?.name).toBe("Perú");
  });
});
