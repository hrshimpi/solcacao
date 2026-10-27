// A strip of five featured products on the home page, loaded from the API.
// While they load there are grey placeholder cards. If the request fails (or nothing comes back),
// the whole section is hidden, so the rest of the page works as if it was never there.
import { FEATURED_COUNT } from "../../../api/products";
import { useLang } from "../../../i18n/LanguageContext";
import { ArrowRightIcon } from "../../../ui/Icons";
import LocaleLink from "../../../ui/LocaleLink";
import type { FeaturedState } from "../useFeaturedProducts";
import ShowcaseCard from "./ShowcaseCard";

const gridClass = "grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5";

function SkeletonCard() {
  return (
    <li className="animate-pulse border border-ink-cacao/30 bg-stone-paper">
      <div className="aspect-[4/5] bg-clay-surface" />
      <div className="space-y-2 border-t border-ink-cacao/30 p-4">
        <div className="h-3.5 w-2/3 bg-clay-surface" />
        <div className="h-3 w-1/2 bg-clay-surface" />
      </div>
    </li>
  );
}

export default function SeasonalShowcase({ state }: { state: FeaturedState }) {
  const { t } = useLang();

  if (state.status === "failed" || (state.status === "ready" && state.products.length === 0)) return null;

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

        {state.status === "loading" ? (
          <>
            <p role="status" className="sr-only">
              {t("home.showcaseLoading")}
            </p>
            <ul aria-hidden="true" className={gridClass}>
              {Array.from({ length: FEATURED_COUNT }, (_, index) => (
                <SkeletonCard key={index} />
              ))}
            </ul>
          </>
        ) : (
          <ul className={gridClass}>
            {state.products.map((product) => (
              <li key={product.id}>
                <ShowcaseCard product={product} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
