// The products of the shop, from the API. They are loaded once for the language of the page (again when the language
// changes), and every page that needs products reads them from here: the shop, a product page, the sampler, the search box
// and the home page. Until the answer is there the status is "loading", and when it fails it is "failed" with a way to
// try again, so each page can say what is going on instead of showing an empty shop.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchProducts, type Product } from "../../api/products";
import type { Lang } from "../../i18n";
import { useLang } from "../../i18n/LanguageContext";

export type ProductsStatus = "loading" | "ready" | "failed";

export interface Origin {
  id: string;
  name: string;
}

interface ProductsValue {
  status: ProductsStatus;
  products: Product[];
  // the countries the products come from, in the order they first appear
  origins: Origin[];
  bySlug: (slug: string | undefined) => Product | undefined;
  byId: (id: string) => Product | undefined;
  // asks again, after a failure
  reload: () => void;
}

// A way to start the app with the products already known, without asking the server (the tests of pages provide it
// around the router). Nothing in the app provides it, so a real page always asks.
export const InitialProductsContext = createContext<((lang: Lang) => Product[]) | undefined>(undefined);

const ProductsContext = createContext<ProductsValue | null>(null);

export function originsOf(products: Product[]): Origin[] {
  const seen = new Map<string, Origin>();
  for (const product of products) {
    if (product.origin && !seen.has(product.origin)) seen.set(product.origin, { id: product.origin, name: product.originName });
  }
  return [...seen.values()];
}

export function ProductsProvider({ children }: { children: ReactNode }) {
  const { lang } = useLang();
  const initial = useContext(InitialProductsContext);
  const [state, setState] = useState<{ lang: Lang; status: ProductsStatus; products: Product[] }>(() =>
    initial ? { lang, status: "ready", products: initial(lang) } : { lang, status: "loading", products: [] },
  );
  // goes up when somebody asks again after a failure
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // the language of this page is already there (the tests start with the products, a reload of the same page)
    if (initial) {
      setState({ lang, status: "ready", products: initial(lang) });
      return;
    }

    const controller = new AbortController();
    setState((current) => ({ lang, status: "loading", products: current.lang === lang ? current.products : [] }));

    fetchProducts(lang, controller.signal)
      .then((products) => setState({ lang, status: "ready", products }))
      .catch(() => {
        // a cancelled request is not a failure, a newer one is already on its way
        if (!controller.signal.aborted) setState({ lang, status: "failed", products: [] });
      });

    return () => controller.abort();
  }, [lang, attempt, initial]);

  const reload = useCallback(() => setAttempt((count) => count + 1), []);

  const value = useMemo<ProductsValue>(() => {
    // products of another language are never shown as if they were of this one
    const products = state.lang === lang ? state.products : [];
    return {
      status: state.lang === lang ? state.status : "loading",
      products,
      origins: originsOf(products),
      bySlug: (slug) => products.find((product) => product.slug === slug?.toLowerCase()),
      byId: (id) => products.find((product) => product.id === id),
      reload,
    };
  }, [state, lang, reload]);

  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>;
}

export function useProducts() {
  const value = useContext(ProductsContext);
  if (!value) throw new Error("useProducts must be used inside ProductsProvider");
  return value;
}
