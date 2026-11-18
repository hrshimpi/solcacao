import { act, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { LanguageProvider } from "../../i18n/LanguageContext";
import { AnnounceProvider } from "../../ui/LiveRegion";
import { installFakeServer, retailAccount, type FakeServer } from "../../test/fakeServer";
import { productsFor } from "../../test/productFixtures";
import { AuthProvider, useAuth } from "../auth/AuthContext";
import { InitialProductsContext, ProductsProvider } from "../catalog/ProductsContext";
import { CartProvider, useCart } from "./CartContext";

const products = productsFor("en");
const ecuador = products.find((product) => product.slug === "ecuador-72")!;
const peru = products.find((product) => product.slug === "peru-68")!;
const soldOut = products.find((product) => product.slug === "fleur-de-sel-bar")!;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={["/en"]}>
      <LanguageProvider>
        <AnnounceProvider>
          <AuthProvider initial={{ status: "guest" }}>
            <InitialProductsContext.Provider value={productsFor}>
              <ProductsProvider>
                <CartProvider>{children}</CartProvider>
              </ProductsProvider>
            </InitialProductsContext.Provider>
          </AuthProvider>
        </AnnounceProvider>
      </LanguageProvider>
    </MemoryRouter>
  );
}

// mounts the cart for a visitor, and waits until the server has answered with the cart
async function setup(server: FakeServer = installFakeServer()) {
  const view = renderHook(() => ({ cart: useCart(), auth: useAuth() }), { wrapper });
  await waitFor(() => expect(view.result.current.cart.status).toBe("ready"));
  return { server, ...view };
}

describe("cart", () => {
  it("is loading until the server has answered, and then it is empty", async () => {
    installFakeServer();
    const { result } = renderHook(() => useCart(), { wrapper });

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.lines).toEqual([]);
    expect(result.current.count).toBe(0);
    expect(result.current.subtotal).toBe(0);
  });

  it("merges repeated adds of the same product into one line", async () => {
    const { result } = await setup();

    await act(() => result.current.cart.addProduct(ecuador.id));
    await act(() => result.current.cart.addProduct(ecuador.id, 2));

    expect(result.current.cart.lines).toHaveLength(1);
    expect(result.current.cart.lines[0].quantity).toBe(3);
    expect(result.current.cart.count).toBe(3);
  });

  it("adds up the subtotal across products, in dollars", async () => {
    const { result } = await setup();

    await act(() => result.current.cart.addProduct(ecuador.id, 2));
    await act(() => result.current.cart.addProduct(peru.id));

    expect(result.current.cart.subtotal).toBe(ecuador.price * 2 + peru.price);
  });

  it("adds a sampler as one line that costs the sum of its products", async () => {
    const { result } = await setup();
    const chosen = products.slice(0, 4);

    await act(() => result.current.cart.addSampler(chosen.map((product) => product.id)));

    const [line] = result.current.cart.lines;
    expect(result.current.cart.lines).toHaveLength(1);
    expect(line.kind).toBe("sampler");
    expect(line.products).toHaveLength(4);
    expect(result.current.cart.subtotal).toBe(chosen.reduce((sum, product) => sum + product.price, 0));
  });

  it("changes the quantity of a line", async () => {
    const { result } = await setup();
    await act(() => result.current.cart.addProduct(ecuador.id));

    await act(() => result.current.cart.setQuantity(result.current.cart.lines[0].id, 5));

    expect(result.current.cart.lines[0].quantity).toBe(5);
    expect(result.current.cart.subtotal).toBe(ecuador.price * 5);
  });

  it("leaves the cart as it was when the server refuses a quantity, and says so", async () => {
    const { result } = await setup();
    await act(() => result.current.cart.addProduct(ecuador.id));

    await act(() => result.current.cart.setQuantity(result.current.cart.lines[0].id, 500));

    expect(result.current.cart.lines[0].quantity).toBe(1);
    expect(result.current.cart.problem).toBe("unknown");
    expect(screen.getByRole("status")).toHaveTextContent(/was not changed/i);
  });

  it("removes a line", async () => {
    const { result } = await setup();
    await act(() => result.current.cart.addProduct(ecuador.id));

    await act(() => result.current.cart.removeLine(result.current.cart.lines[0].id));

    expect(result.current.cart.lines).toEqual([]);
  });

  it("opens the drawer when something is added, and closes it", async () => {
    const { result } = await setup();

    await act(() => result.current.cart.addProduct(ecuador.id));
    expect(result.current.cart.isOpen).toBe(true);

    act(() => result.current.cart.close());
    expect(result.current.cart.isOpen).toBe(false);
  });

  it("sends quick changes to the server one after the other, in the order they were made", async () => {
    const { result, server } = await setup();

    await act(async () => {
      await Promise.all([result.current.cart.addProduct(ecuador.id), result.current.cart.addProduct(ecuador.id), result.current.cart.addProduct(peru.id)]);
    });

    expect(server.callsTo("POST", "/api/cart/items").map((call) => (call.body as { productId: string }).productId)).toEqual([ecuador.id, ecuador.id, peru.id]);
    expect(result.current.cart.count).toBe(3);
  });
});

describe("cart on the server", () => {
  it("is still there when the page is opened again", async () => {
    const first = await setup();
    await act(() => first.result.current.cart.addProduct(ecuador.id, 2));
    first.unmount();

    const second = await setup(first.server);

    expect(second.result.current.cart.lines).toHaveLength(1);
    expect(second.result.current.cart.count).toBe(2);
  });

  it("adds the cart of the visitor to the cart of the person who signs in", async () => {
    const { result, server } = await setup();
    await act(() => result.current.cart.addProduct(ecuador.id, 2));

    await act(async () => {
      await result.current.auth.signIn(retailAccount.email, retailAccount.password);
    });

    await waitFor(() => expect(server.callsTo("POST", "/api/cart/merge")).toHaveLength(1));
    await waitFor(() => expect(result.current.cart.count).toBe(2));
    expect(result.current.cart.lines[0].products[0].id).toBe(ecuador.id);
  });

  it("does not ask for the cart of a signed in person before it is known who is here", async () => {
    const server = installFakeServer();
    const loading = renderHook(() => useCart(), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={["/en"]}>
          <LanguageProvider>
            <AnnounceProvider>
              <AuthProvider>
                <InitialProductsContext.Provider value={productsFor}>
                  <ProductsProvider>
                    <CartProvider>{children}</CartProvider>
                  </ProductsProvider>
                </InitialProductsContext.Provider>
              </AuthProvider>
            </AnnounceProvider>
          </LanguageProvider>
        </MemoryRouter>
      ),
    });

    // the page asks who is here (nobody has a cookie), and only then for the cart
    await waitFor(() => expect(loading.result.current.status).toBe("ready"));
    const paths = server.calls.map((call) => call.path);
    const firstCartCall = paths.findIndex((path) => path.startsWith("/api/cart"));
    expect(paths.indexOf("/api/auth/refresh")).toBeGreaterThanOrEqual(0);
    expect(paths.indexOf("/api/auth/refresh")).toBeLessThan(firstCartCall);
  });
});

describe("stock", () => {
  it("adds what fits and says how many there are when the stock is smaller than the request", async () => {
    const { result, server } = await setup();
    server.setStock("peru-68", 3);

    await act(() => result.current.cart.addProduct(peru.id, 5));

    expect(result.current.cart.lines[0].quantity).toBe(3);
    expect(screen.getByRole("status")).toHaveTextContent("Only 3 of Peru");
  });

  it("adds nothing to a product that is sold out, and says so", async () => {
    const { result } = await setup();

    await act(() => result.current.cart.addProduct(soldOut.id));

    expect(result.current.cart.lines).toEqual([]);
    expect(screen.getByRole("status")).toHaveTextContent(`${soldOut.name} is sold out`);
  });

  it("lowers the quantity to what there is when the stock fell below what is in the cart", async () => {
    const { result, server } = await setup();
    await act(() => result.current.cart.addProduct(peru.id, 4));
    server.setStock("peru-68", 2);

    await act(async () => {
      result.current.cart.retry();
    });

    await waitFor(() => expect(result.current.cart.lines[0].quantity).toBe(2));
    expect(screen.getByRole("status")).toHaveTextContent("Only 2 of Peru");
  });
});

describe("when the server cannot be reached", () => {
  it("says that the cart could not be loaded, and loads it when asked again", async () => {
    const server = installFakeServer();
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    const { result } = renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("failed"));

    vi.stubGlobal("fetch", vi.fn(server.handle));
    await act(async () => {
      result.current.retry();
    });

    await waitFor(() => expect(result.current.status).toBe("ready"));
  });

  it("keeps the cart as it was when a change does not reach the server, and says so", async () => {
    const { result, server } = await setup();
    await act(() => result.current.cart.addProduct(ecuador.id));
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));

    await act(() => result.current.cart.addProduct(peru.id));

    expect(result.current.cart.lines).toHaveLength(1);
    expect(result.current.cart.problem).toBe("network");
    expect(screen.getByRole("status")).toHaveTextContent(/couldn't reach the server/i);

    vi.stubGlobal("fetch", vi.fn(server.handle));
    await act(() => result.current.cart.addProduct(peru.id));
    expect(result.current.cart.problem).toBeNull();
    expect(result.current.cart.lines).toHaveLength(2);
  });
});

describe("useCart", () => {
  it("complains when used outside the provider", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useCart())).toThrow(/CartProvider/);

    quiet.mockRestore();
  });
});
