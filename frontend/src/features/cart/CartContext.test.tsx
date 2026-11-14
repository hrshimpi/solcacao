import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { getProducts } from "../../data/products";
import { LanguageProvider } from "../../i18n/LanguageContext";
import { AnnounceProvider } from "../../ui/LiveRegion";
import { CartProvider, useCart } from "./CartContext";

const products = getProducts("en");

function setup() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={["/en"]}>
      <LanguageProvider>
        <AnnounceProvider>
          <CartProvider>{children}</CartProvider>
        </AnnounceProvider>
      </LanguageProvider>
    </MemoryRouter>
  );
  return renderHook(() => useCart(), { wrapper });
}

describe("cart", () => {
  it("starts empty", () => {
    const { result } = setup();

    expect(result.current.lines).toEqual([]);
    expect(result.current.count).toBe(0);
    expect(result.current.subtotal).toBe(0);
  });

  it("merges repeated adds of the same product into one line", () => {
    const { result } = setup();

    act(() => result.current.addProduct(products[0].id));
    act(() => result.current.addProduct(products[0].id, 2));

    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].quantity).toBe(3);
    expect(result.current.count).toBe(3);
  });

  it("adds up the subtotal across products", () => {
    const { result } = setup();

    act(() => result.current.addProduct(products[0].id, 2));
    act(() => result.current.addProduct(products[1].id));

    expect(result.current.subtotal).toBe(products[0].price * 2 + products[1].price);
  });

  it("adds a sampler as one line that costs the sum of its products", () => {
    const { result } = setup();
    const chosen = products.slice(0, 4);

    act(() => result.current.addSampler(chosen.map((product) => product.id)));

    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].kind).toBe("sampler");
    expect(result.current.lines[0].productIds).toHaveLength(4);
    expect(result.current.subtotal).toBe(chosen.reduce((sum, product) => sum + product.price, 0));
  });

  it("keeps the quantity between 1 and 99", () => {
    const { result } = setup();

    act(() => result.current.addProduct(products[0].id));
    const id = result.current.lines[0].id;

    act(() => result.current.setQuantity(id, 0));
    expect(result.current.lines[0].quantity).toBe(1);

    act(() => result.current.setQuantity(id, 500));
    expect(result.current.lines[0].quantity).toBe(99);
  });

  it("removes a line", () => {
    const { result } = setup();

    act(() => result.current.addProduct(products[0].id));
    act(() => result.current.removeLine(result.current.lines[0].id));

    expect(result.current.lines).toEqual([]);
  });

  it("opens the drawer when something is added, and closes it", () => {
    const { result } = setup();

    act(() => result.current.addProduct(products[0].id));
    expect(result.current.isOpen).toBe(true);

    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
  });
});

describe("cart storage", () => {
  it("saves the cart and loads it again on the next visit", () => {
    const first = setup();
    act(() => first.result.current.addProduct(products[0].id, 2));
    first.unmount();

    const second = setup();

    expect(second.result.current.lines).toHaveLength(1);
    expect(second.result.current.count).toBe(2);
  });

  it("ignores a broken saved cart", () => {
    localStorage.setItem("sc_cart", "{not json");

    expect(setup().result.current.lines).toEqual([]);
  });

  it("drops saved lines that are not valid", () => {
    localStorage.setItem(
      "sc_cart",
      JSON.stringify([
        { id: "p-999", kind: "product", productIds: [999], quantity: 1 },
        { id: "p-1", kind: "product", productIds: [1], quantity: -4 },
        { id: "p-2", kind: "product", productIds: [2], quantity: 2 },
      ]),
    );

    const { result } = setup();

    expect(result.current.lines.map((line) => line.id)).toEqual(["p-2"]);
  });
});

describe("useCart", () => {
  it("complains when used outside the provider", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useCart())).toThrow(/CartProvider/);

    quiet.mockRestore();
  });
});
