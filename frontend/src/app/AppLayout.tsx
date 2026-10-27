// The layout every page shares: skip link, header, main content, footer, and the cart and search dialogs.
// It also scrolls to the top and moves focus to the page heading when the page changes.
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Outlet, useLocation } from "react-router";
import CartDrawer from "../features/cart/CartDrawer";
import { CartProvider } from "../features/cart/CartContext";
import Footer from "../features/shell/Footer";
import Nav from "../features/shell/Nav";
import SearchDialog from "../features/shell/SearchDialog";
import { LanguageProvider, useLang } from "../i18n/LanguageContext";
import { AnnounceProvider } from "../ui/LiveRegion";

function Shell() {
  const { t } = useLang();
  const { pathname, hash } = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const lastPage = useRef<string | null>(null);

  // the same page in the other language is not a page change
  const page = pathname.replace(/^\/(en|es)(?=\/|$)/, "") || "/";

  useEffect(() => {
    if (hash) {
      const target = document.getElementById(hash.slice(1));
      if (target) {
        target.scrollIntoView?.();
        lastPage.current = page;
        return;
      }
    }
    if (lastPage.current === page) return;

    const firstLoad = lastPage.current === null;
    lastPage.current = page;
    window.scrollTo(0, 0);
    if (firstLoad) return;

    const target = document.querySelector<HTMLElement>("main h1") ?? document.getElementById("main-content");
    if (target) {
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    }
  }, [page, hash]);

  function skipToMain(event: MouseEvent) {
    event.preventDefault();
    const main = document.getElementById("main-content");
    main?.focus();
    main?.scrollIntoView?.();
  }

  return (
    <div className="min-h-dvh bg-stone-paper">
      <a
        href="#main-content"
        onClick={skipToMain}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-ink-cacao focus:px-4 focus:py-3 focus:font-sans focus:text-sm focus:text-paper-text focus:outline-sun-gold"
      >
        {t("common.skipToMain")}
      </a>
      <Nav onSearchOpen={() => setSearchOpen(true)} />
      <main id="main-content" tabIndex={-1} className="pt-14">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

export default function AppLayout() {
  return (
    <LanguageProvider>
      <AnnounceProvider>
        <CartProvider>
          <Shell />
        </CartProvider>
      </AnnounceProvider>
    </LanguageProvider>
  );
}
