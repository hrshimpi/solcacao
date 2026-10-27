// The batch passport card: batch code, harvest and roast dates, farm and cacao percentage.
import type { Product } from "../../../data/products";
import { formatMonth } from "../../../i18n/format";
import { useLang } from "../../../i18n/LanguageContext";

export default function BatchPassport({ product }: { product: Product }) {
  const { t, lang } = useLang();

  const details = [
    { label: t("product.harvestDate"), value: formatMonth(product.harvestMonth, lang) },
    { label: t("product.roastDate"), value: formatMonth(product.roastMonth, lang) },
    { label: t("product.farm"), value: product.farm },
    { label: t("product.cacaoPercent"), value: `${product.percentage}%` },
  ];

  return (
    <section aria-labelledby="batch-passport" className="border border-ink-cacao bg-clay-surface p-5">
      <div className="mb-4 border-b border-ink-cacao/30 pb-3">
        <h2 id="batch-passport" className="font-sans text-[11px] uppercase tracking-[0.2em] text-ink-cacao/70">
          {t("product.batchPassport")}
        </h2>
        <p className="mt-0.5 font-mono text-sm font-medium text-ink-cacao">{product.batchCode}</p>
      </div>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        {details.map((detail) => (
          <div key={detail.label}>
            <dt className="font-sans text-[11px] uppercase tracking-widest text-ink-cacao/70">{detail.label}</dt>
            <dd className="mt-0.5 font-spectral text-sm leading-snug text-ink-cacao">{detail.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
