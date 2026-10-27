// The shop page: filters (a column from lg up, a dialog behind a Filters button below that) and the product grid.
// The filters live in the address, so a filtered view can be shared or refreshed.
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { getProducts } from "../../data/products";
import { useLang } from "../../i18n/LanguageContext";
import { usePageTitle } from "../../lib/usePageTitle";
import Drawer from "../../ui/Drawer";
import FilterPanel from "./components/FilterPanel";
import ProductGrid from "./components/ProductGrid";
import { applyFilters, defaultFilters, filtersFromParams, paramsFromFilters, type Filters } from "./filters";

export default function CatalogPage() {
  const { t, lang } = useLang();
  usePageTitle(t("titles.shop"));

  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filters = useMemo(() => filtersFromParams(params), [params]);
  const products = useMemo(() => getProducts(lang), [lang]);
  const shown = useMemo(() => applyFilters(products, filters), [products, filters]);

  function change(next: Filters) {
    setParams(paramsFromFilters(next), { replace: true });
  }

  return (
    <div className="bg-stone-paper">
      <div className="border-b border-ink-cacao">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4 px-4 py-10 sm:px-6">
          <div>
            <h1 className="font-spectral text-4xl font-semibold text-ink-cacao">{t("catalog.title")}</h1>
            <p role="status" className="mt-1.5 font-sans text-xs text-ink-cacao/70">
              {t("catalog.count", { count: shown.length })} · {t("catalog.harvest")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            aria-haspopup="dialog"
            className="min-h-11 border border-ink-cacao px-5 py-2 font-sans text-sm text-ink-cacao hover:bg-clay-surface lg:hidden"
          >
            {t("catalog.filters")}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:grid lg:grid-cols-[13rem_1fr] lg:gap-12">
        <aside aria-label={t("catalog.filters")} className="hidden lg:block">
          <FilterPanel filters={filters} onChange={change} />
        </aside>

        <Drawer open={filtersOpen} onClose={() => setFiltersOpen(false)} title={t("catalog.filters")} side="left" tone="light">
          <div className="px-6 py-6">
            <FilterPanel filters={filters} onChange={change} />
          </div>
        </Drawer>

        <div>
          {shown.length === 0 ? (
            <div className="border border-ink-cacao p-10 text-center sm:p-16">
              <p className="font-spectral text-xl text-ink-cacao">{t("catalog.empty")}</p>
              <button
                type="button"
                onClick={() => change(defaultFilters)}
                className="mt-4 min-h-11 border border-ink-cacao px-5 font-sans text-sm text-ink-cacao hover:bg-ink-cacao hover:text-stone-paper"
              >
                {t("catalog.clearAll")}
              </button>
            </div>
          ) : (
            <ProductGrid products={shown} />
          )}
        </div>
      </div>
    </div>
  );
}
