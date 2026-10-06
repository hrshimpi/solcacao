import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { CartProvider, useCart } from "../features/cart/CartContext";
import CartDrawer from "../features/cart/CartDrawer";
import Footer from "../features/shell/Footer";
import Nav from "../features/shell/Nav";

const pagesWithoutFooter = ["/login", "/register", "/wholesale/studio"];

function Shell() {
  const { pathname } = useLocation();
  const { count, open } = useCart();
  const [lang, setLang] = useState<"EN" | "ES">("EN");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);

  return (
    <div className="min-h-screen bg-stone-paper">
      <Nav cartCount={count} lang={lang} setLang={setLang} onCartOpen={open} />
      <Outlet />
      {!pagesWithoutFooter.includes(pathname) && <Footer />}
      <CartDrawer />
    </div>
  );
}

export default function AppLayout() {
  return (
    <CartProvider>
      <Shell />
    </CartProvider>
  );
}
