// Loads the featured products for the home page, again whenever the language changes.
// There is no error state to show: when the request fails the showcase is simply hidden.
import { useEffect, useState } from "react";
import { fetchFeaturedProducts, type FeaturedProduct } from "../../api/products";
import { useLang } from "../../i18n/LanguageContext";

export type FeaturedState = { status: "loading" } | { status: "ready"; products: FeaturedProduct[] } | { status: "failed" };

export function useFeaturedProducts(): FeaturedState {
  const { lang } = useLang();
  const [state, setState] = useState<FeaturedState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });

    fetchFeaturedProducts(lang, controller.signal)
      .then((products) => setState({ status: "ready", products }))
      .catch(() => {
        // a cancelled request is not a failure, a newer one is already on its way
        if (!controller.signal.aborted) setState({ status: "failed" });
      });

    // leaving the page or switching language cancels the old request, so an old answer can never win
    return () => controller.abort();
  }, [lang]);

  return state;
}
