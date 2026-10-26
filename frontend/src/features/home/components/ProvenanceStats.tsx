// Four numbers about where the chocolate comes from. The origin count and cacao range come from the product data.
import { getOriginIds, getProducts } from "../../../data/products";
import { useLang } from "../../../i18n/LanguageContext";

export default function ProvenanceStats() {
  const { t } = useLang();
  const percentages = getProducts("en").map((product) => product.percentage);

  const stats = [
    { value: String(getOriginIds().length), label: t("home.statOrigins"), sub: t("home.statOriginsSub") },
    { value: "40+", label: t("home.statFamilies"), sub: t("home.statFamiliesSub") },
    { value: "100%", label: t("home.statDirect"), sub: t("home.statDirectSub") },
    { value: `${Math.min(...percentages)}-${Math.max(...percentages)}%`, label: t("home.statRange"), sub: t("home.statRangeSub") },
  ];

  return (
    <section aria-label={t("home.statsLabel")} className="border-t border-ink-cacao bg-stone-paper py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <ul className="grid grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <li
              key={stat.label}
              className={`px-4 py-6 sm:px-6 sm:py-8 ${index % 2 === 0 ? "border-r border-ink-cacao" : ""} ${
                index < 3 ? "lg:border-r lg:border-ink-cacao" : "lg:border-r-0"
              }`}
            >
              <p className="mb-1 font-spectral text-4xl font-semibold text-pod-wine">{stat.value}</p>
              <p className="font-sans text-sm font-medium text-ink-cacao">{stat.label}</p>
              <p className="mt-0.5 font-sans text-xs text-ink-cacao/70">{stat.sub}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
