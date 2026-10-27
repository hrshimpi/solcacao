// One featured product in the seasonal showcase. The whole card opens the product page.
import type { FeaturedProduct } from "../../../api/products";
import { formatPrice } from "../../../i18n/format";
import { useLang } from "../../../i18n/LanguageContext";
import LocaleLink from "../../../ui/LocaleLink";

export default function ShowcaseCard({ product }: { product: FeaturedProduct }) {
  const { lang } = useLang();

  return (
    <article className="group relative flex h-full flex-col border border-ink-cacao bg-stone-paper">
      <div className="aspect-[4/5] overflow-hidden bg-clay-surface">
        {product.image && (
          <img
            src={product.image}
            alt={product.imageAlt}
            width={480}
            height={600}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col border-t border-ink-cacao p-4">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h3 className="font-spectral text-sm font-semibold text-ink-cacao">
            <LocaleLink to={`/shop/${product.slug}`} className="after:absolute after:inset-0 hover:text-pod-wine">
              {product.name}
            </LocaleLink>
          </h3>
          {product.price !== null && (
            <p className="shrink-0 font-sans text-sm font-medium text-gold-deep">{formatPrice(product.price, lang)}</p>
          )}
        </div>
        {product.flavor && <p className="font-sans text-xs leading-snug text-ink-cacao/70">{product.flavor}</p>}
      </div>
    </article>
  );
}
