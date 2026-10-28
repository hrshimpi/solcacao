// One product tile with photo, name, caption and price. The whole card opens the product page,
// and the Add to cart button (full variant) sits on top of it.
import type { Product } from "../../../data/products";
import { formatPrice } from "../../../i18n/format";
import { useLang } from "../../../i18n/LanguageContext";
import { stockStatus } from "../../../lib/stock";
import LocaleLink from "../../../ui/LocaleLink";
import StockBadge from "../../../ui/StockBadge";
import { useCart } from "../../cart/CartContext";

interface ProductCardProps {
  product: Product;
  variant?: "full" | "compact";
  priority?: boolean;
}

export default function ProductCard({ product, variant = "full", priority = false }: ProductCardProps) {
  const { t, lang } = useLang();
  const { addProduct } = useCart();
  const stock = stockStatus(product.stock);
  const soldOut = stock === "out";

  return (
    <article className="group relative flex h-full flex-col border border-ink-cacao bg-stone-paper">
      <div className="relative aspect-[4/5] overflow-hidden bg-clay-surface">
        <img
          src={product.image}
          alt={product.imageAlt}
          width={480}
          height={600}
          loading={priority ? "eager" : "lazy"}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <StockBadge status={stock} className="absolute left-2 top-2" />
      </div>
      <div className="flex flex-1 flex-col border-t border-ink-cacao p-4">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h2 className="font-spectral text-sm font-semibold text-ink-cacao">
            <LocaleLink
              to={`/shop/${product.slug}`}
              className="after:absolute after:inset-0 hover:text-pod-wine"
            >
              {product.name}
            </LocaleLink>
          </h2>
          <p className="shrink-0 font-sans text-sm font-medium text-gold-deep">{formatPrice(product.price, lang)}</p>
        </div>
        <p className="mb-3 font-sans text-xs leading-snug text-ink-cacao/70">{product.caption}</p>
        {variant === "full" && (
          <button
            type="button"
            onClick={() => addProduct(product.id)}
            disabled={soldOut}
            aria-label={soldOut ? t("stock.soldOutNamed", { name: product.name }) : t("catalog.addNamed", { name: product.name })}
            className="relative z-10 mt-auto min-h-11 w-full border border-ink-cacao py-2 font-sans text-xs font-medium text-ink-cacao hover:bg-ink-cacao hover:text-stone-paper disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-ink-cacao"
          >
            {soldOut ? t("stock.out") : t("catalog.addToCart")}
          </button>
        )}
      </div>
    </article>
  );
}