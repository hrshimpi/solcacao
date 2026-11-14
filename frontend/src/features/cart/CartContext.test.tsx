import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { products } from "../../data/products";
import { CartProvider, useCart } from "./CartContext";

function setup() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <CartProvider>{children}</CartProvider>
  );
  return renderHook(() => useCart(), { wrapper });
}

describe("cart", () => {
  it("starts empty", () => {
    const { result } = setup();

    expect(result.current.items).toEqual([]);
    expect(result.current.count).toBe(0);
    expect(result.current.subtotal).toBe(0);
  });

  it("merges repeated adds of the same product into one line", () => {
    const { result } = setup();

    act(() => result.current.addItem(products[0]));
    act(() => result.current.addItem(products[0], 2));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(3);
    expect(result.current.count).toBe(3);
  });

  it("adds up the subtotal across products", () => {
    const { result } = setup();

    act(() => result.current.addItem(products[0], 2));
    act(() => result.current.addItem(products[1]));

    expect(result.current.subtotal).toBe(products[0].price * 2 + products[1].price);
  });

  it("removes a line when the quantity drops to zero", () => {
    const { result } = setup();

    act(() => result.current.addItem(products[0]));
    act(() => result.current.setQuantity(products[0].id, 0));

    expect(result.current.items).toEqual([]);
  });

  it("opens and closes", () => {
    const { result } = setup();

    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);

    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
  });
});

describe("useCart", () => {
  it("complains when used outside the provider", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useCart())).toThrow(/CartProvider/);

    quiet.mockRestore();
  });
});
