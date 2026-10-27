// The tray preview and the list of chosen specimens, each with a Remove button.
import type { Product } from "../../../data/products";
import { formatPrice } from "../../../i18n/format";
import { useLang } from "../../../i18n/LanguageContext";

interface SamplerTrayProps {
  selected: Product[];
  slots: number;
  onRemove: (id: number) => void;
}

export default function SamplerTray({ selected, slots, onRemove }: SamplerTrayProps) {
  const { t, lang } = useLang();
  const total = selected.reduce((sum, product) => sum + product.price, 0);

  return (
    <div className="mb-6 border-2 border-pod-wine bg-clay-surface p-4 sm:p-6">
      {/* the picture of the tray repeats the list below, so screen readers skip it */}
      <div aria-hidden="true" className="grid grid-cols-3 gap-3">
        {Array.from({ length: slots }, (_, index) => {
          const product = selected[index];
          return (
            <div
              key={index}
              className={`aspect-square ${product ? "overflow-hidden border border-pod-wine/60" : "border border-dashed border-ink-cacao/50"}`}
            >
              {product ? (
                <img src={product.image} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center font-sans text-xs text-ink-cacao/70">{index + 1}</span>
              )}
            </div>
          );
        })}
      </div>

      {selected.length === 0 ? (
        <p className="mt-4 font-sans text-xs text-ink-cacao/70">{t("sampler.empty")}</p>
      ) : (
        <div className="mt-4 border-t border-ink-cacao/20 pt-2">
          <ul>
            {selected.map((product) => (
              <li key={product.id} className="flex items-center justify-between gap-3">
                <span className="font-spectral text-sm text-ink-cacao">{product.name}</span>
                <span className="flex items-center gap-3">
                  <span className="font-sans text-xs text-gold-deep">{formatPrice(product.price, lang)}</span>
                  <button
                    type="button"
                    onClick={() => onRemove(product.id)}
                    aria-label={t("sampler.removeNamed", { name: product.name })}
                    className="min-h-11 px-1 font-sans text-xs text-ink-cacao underline underline-offset-4 hover:text-pod-wine"
                  >
                    {t("sampler.remove")}
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 flex items-center justify-between border-t border-ink-cacao/20 pt-3">
            <span className="font-sans text-xs text-ink-cacao/70">{t("sampler.total")}</span>
            <span className="font-sans text-sm font-medium text-ink-cacao">{formatPrice(total, lang)}</span>
          </p>
        </div>
      )}
    </div>
  );
}
