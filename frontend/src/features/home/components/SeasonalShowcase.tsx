// A strip of five products on the home page, linking to the full shop.
import { getProducts } from "../../../data/products";
import { useLang } from "../../../i18n/LanguageContext";
import { ArrowRightIcon } from "../../../ui/Icons";
import LocaleLink from "../../../ui/LocaleLink";
import ProductGrid from "../../catalog/components/ProductGrid";

export default function SeasonalShowcase() {
  const { t, lang } = useLang();
  const showcase = getProducts(lang).slice(0, 5);

  return (
    <section aria-labelledby="showcase-title" className="bg-stone-paper py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-8 flex flex-wrap items-baseline justify-between gap-2 border-b border-ink-cacao pb-4">
          <div>
            <h2 id="showcase-title" className="font-spectral text-2xl font-semibold text-ink-cacao">
              {t("home.showcaseTitle")}
            </h2>
            <p className="mt-1 font-sans text-xs text-ink-cacao/70">{t("home.showcaseSub")}</p>
          </div>
          <LocaleLink
            to="/shop"
            className="inline-flex min-h-11 items-center gap-2 font-sans text-sm text-ink-cacao underline underline-offset-4 hover:text-pod-wine"
          >
            {t("home.viewAll")}
            <ArrowRightIcon size={16} />
          </LocaleLink>
        </div>
        <ProductGrid products={showcase} variant="compact" className="grid-cols-1 sm:grid-cols-3 lg:grid-cols-5" />
      </div>
    </section>
  );
}
