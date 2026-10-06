import { useState, useEffect } from "react";
import { Page, Product, CartItem } from "./types";
import { products } from "./data/products";
import Nav from "./components/Nav";
import Footer from "./components/Footer";
import Home from "./components/Home";
import Catalog from "./components/Catalog";
import ProductDetail from "./components/ProductDetail";
import Wholesale from "./components/Wholesale";
import Studio from "./components/Studio";
import Auth from "./components/Auth";
import Sampler from "./components/Sampler";

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [selectedProduct, setSelectedProduct] = useState<Product>(products[0]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [lang, setLang] = useState<"EN" | "ES">("EN");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.product.id === product.id);
      if (existing) {
        return prev.map((ci) =>
          ci.product.id === product.id
            ? { ...ci, quantity: ci.quantity + 1 }
            : ci
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQty = (id: number, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((ci) => ci.product.id !== id));
    } else {
      setCart((prev) =>
        prev.map((ci) =>
          ci.product.id === id ? { ...ci, quantity: qty } : ci
        )
      );
    }
  };

  const cartCount = cart.reduce((s, ci) => s + ci.quantity, 0);

  const showFooter = !["auth", "studio"].includes(page);

  return (
    <div className="min-h-screen bg-stone-paper">
      <Nav
        page={page}
        setPage={setPage}
        cartCount={cartCount}
        lang={lang}
        setLang={setLang}
        onCartOpen={() => setCartOpen(true)}
      />

      {page === "home" && (
        <Home
          setPage={setPage}
          setSelectedProduct={setSelectedProduct}
          products={products}
        />
      )}

      {page === "catalog" && (
        <Catalog
          products={products}
          cart={cart}
          setPage={setPage}
          setSelectedProduct={setSelectedProduct}
          onAddToCart={addToCart}
          cartOpen={cartOpen}
          setCartOpen={setCartOpen}
          onUpdateQty={updateQty}
        />
      )}

      {page === "product" && (
        <ProductDetail
          product={selectedProduct}
          onAddToCart={addToCart}
          setPage={setPage}
        />
      )}

      {page === "wholesale" && <Wholesale setPage={setPage} />}

      {page === "studio" && <Studio setPage={setPage} />}

      {page === "auth" && <Auth setPage={setPage} />}

      {page === "sampler" && (
        <Sampler products={products} onAddToCart={addToCart} />
      )}

      {showFooter && <Footer setPage={setPage} />}

      {cartOpen && page !== "catalog" && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-ink-cacao/40"
            onClick={() => setCartOpen(false)}
          />
          <div className="relative w-80 bg-ink-cacao h-full flex flex-col slide-in-right">
            <div className="flex items-center justify-between px-6 py-5 border-b border-paper-text/10">
              <p className="font-spectral text-lg text-paper-text">Your cart</p>
              <button
                onClick={() => setCartOpen(false)}
                className="text-paper-text/60 hover:text-paper-text transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <line x1="18" x2="6" y1="6" y2="18" />
                  <line x1="6" x2="18" y1="6" y2="18" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {cart.length === 0 ? (
                <p className="font-spectral text-paper-text/40 text-sm mt-8 text-center">
                  No items yet.
                </p>
              ) : (
                cart.map((ci) => (
                  <div key={ci.product.id} className="border-b border-paper-text/10 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-spectral text-sm text-paper-text font-semibold">
                          {ci.product.name}
                        </p>
                        <p className="font-sans text-[10px] text-paper-text/50 mt-0.5">
                          {ci.product.caption}
                        </p>
                      </div>
                      <p className="font-sans text-sm text-sun-gold font-medium shrink-0">
                        ${ci.product.price * ci.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <div className="flex items-center border border-paper-text/20">
                        <button
                          onClick={() => updateQty(ci.product.id, ci.quantity - 1)}
                          className="font-sans text-sm text-paper-text/70 px-3 py-1 hover:text-paper-text transition-colors"
                        >
                          -
                        </button>
                        <span className="font-sans text-xs text-paper-text px-2 border-x border-paper-text/20">
                          {ci.quantity}
                        </span>
                        <button
                          onClick={() => updateQty(ci.product.id, ci.quantity + 1)}
                          className="font-sans text-sm text-paper-text/70 px-3 py-1 hover:text-paper-text transition-colors"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => updateQty(ci.product.id, 0)}
                        className="font-sans text-[10px] text-paper-text/30 underline hover:text-paper-text/60 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="px-6 py-6 border-t border-paper-text/10">
                <div className="flex justify-between mb-4">
                  <span className="font-sans text-xs text-paper-text/50">Subtotal</span>
                  <span className="font-sans text-lg font-medium text-sun-gold">
                    ${cart.reduce((s, ci) => s + ci.product.price * ci.quantity, 0).toFixed(2)}
                  </span>
                </div>
                <button className="w-full font-sans text-sm font-medium bg-sun-gold text-ink-cacao py-3.5 hover:bg-sun-gold/90 transition-colors">
                  Checkout
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
