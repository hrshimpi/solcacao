// One specimen you can pick for the sampler. It is a toggle button, and the tasting notes show on hover, focus or when picked.
import type { Product } from "../../../data/products";
import { useLang } from "../../../i18n/LanguageContext";
import { stockStatus } from "../../../lib/stock";
import { CheckIcon } from "../../../ui/Icons";
import StockBadge from "../../../ui/StockBadge";

interface SamplerTileProps {
  product: Product;
  selected: boolean;
  full: boolean;
  onToggle: () => void;
}

export default function SamplerTile({ product, selected, full, onToggle }: SamplerTileProps) {
  const { t } = useLang();
  const soldOut = stockStatus(product.stock) === "out";
  const blocked = (full || soldOut) && !selected;
  const detailId = `sampler-detail-${product.id}`;

  return (
    <li className="group flex flex-col items-center gap-2 text-center">
      <button
        type="button"
        id={`sampler-tile-${product.id}`}
        aria-pressed={selected}
        aria-disabled={blocked || undefined}
        aria-describedby={detailId}
        onClick={() => {
          if (!blocked) onToggle();
        }}
        className="flex w-full flex-col items-center gap-2 p-1"
      >
        <span
          className={`relative block aspect-square w-full overflow-hidden rounded-full border-2 ${
            selected
              ? "scale-105 border-pod-wine"
              : blocked
                ? "cursor-not-allowed border-ink-cacao/30 opacity-50"
                : "border-ink-cacao/60 group-hover:border-ink-cacao"
          }`}
        >
          <img src={product.image} alt="" width={160} height={160} loading="lazy" className="h-full w-full object-cover" />
          {selected && (
            <span className="absolute inset-0 flex items-center justify-center bg-pod-wine/40 text-paper-text">
              <CheckIcon size={22} />
            </span>
          )}
        </span>
        <span className="font-spectral text-sm font-semibold leading-tight text-ink-cacao">{product.name}</span>
      </button>
      {soldOut && <StockBadge status="out" />}
      <p
        id={detailId}
        className={`min-h-8 font-sans text-xs leading-snug text-ink-cacao/70 group-focus-within:visible group-hover:visible ${
          selected ? "visible" : "invisible"
        }`}
      >
        {product.tastingSummary}
        {soldOut && <span className="sr-only"> {t("stock.out")}</span>}
        {blocked && !soldOut && <span className="sr-only"> {t("sampler.full")}</span>}
      </p>
    </li>
  );
}