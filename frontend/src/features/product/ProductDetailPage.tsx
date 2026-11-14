// The product page: photos, price, quantity and add to cart, batch passport and the origin story.
import { useState } from "react";
import { useParams } from "react-router";
import { getProductBySlug, originName, type Product } from "../../data/products";
import { formatPrice } from "../../i18n/format";
import { useLang } from "../../i18n/LanguageContext";
import { stockStatus } from "../../lib/stock";
import { usePageTitle } from "../../lib/usePageTitle";
import LocaleLink from "../../ui/LocaleLink";
import QuantityStepper from "../../ui/QuantityStepper";
import StockBadge from "../../ui/StockBadge";
import { useCart } from "../cart/CartContext";
import NotFoundPage from "../shell/NotFoundPage";
import BatchPassport from "./components/BatchPassport";
import OriginMap from "./components/OriginMap";
import ProductGallery from "./components/ProductGallery";

export default function ProductDetailPage() {
  const { slug } = useParams();
  const { lang } = useLang();
  const product = getProductBySlug(slug, lang);

  if (!product) return <NotFoundPage />;
  return <ProductDetail key={product.id} product={product} />;
}

function ProductDetail({ product }: { product: Product }) {
  const { t, lang } = useLang();
  const { addProduct } = useCart();
  const [quantity, setQuantity] = useState(1);
  usePageTitle(product.name);

  const stock = stockStatus(product.stock);
  const soldOut = stock === "out";
  // the stepper never offers more than we have
  const maxQuantity = Math.min(99, product.stock);

  return (
    <div className="bg-stone-paper">
      <nav aria-label={t("product.breadcrumb")} className="border-b border-ink-cacao/15">
        <ol className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-2 px-4 py-2 font-sans text-xs sm:px-6">
          <li>
            <LocaleLink to="/" className="inline-flex min-h-6 items-center text-ink-cacao/70 hover:text-ink-cacao">
              {t("product.home")}
            </LocaleLink>
          </li>
          <li aria-hidden="true" className="text-ink-cacao/70">/</li>
          <li>
            <LocaleLink to="/shop" className="inline-flex min-h-6 items-center text-ink-cacao/70 hover:text-ink-cacao">
              {t("product.shop")}
            </LocaleLink>
          </li>
          <li aria-hidden="true" className="text-ink-cacao/70">/</li>
          <li aria-current="page" className="text-ink-cacao">
            {product.name}
          </li>
        </ol>
      </nav>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[3fr_2fr] lg:gap-16">
        <ProductGallery images={product.images} alt={product.imageAlt} />

        <div className="pt-2">
          <p className="mb-3 font-sans text-[11px] uppercase tracking-[0.2em] text-ink-cacao/70">
            {originName(product.origin, lang)} · {t(`categories.${product.category}`)}
          </p>
          <h1 className="mb-1 font-spectral text-4xl font-semibold text-ink-cacao">{product.name}</h1>
          <p className="mb-2 font-sans text-2xl font-medium text-gold-deep">{formatPrice(product.price, lang)}</p>
          <div className="mb-6 min-h-6">
            {stock === "low" && (
              <p className="font-sans text-sm font-medium text-pod-wine">{t("stock.fewLeft", { count: product.stock })}</p>
            )}
            {soldOut && <StockBadge status={stock} />}
          </div>

          <p className="mb-6 font-spectral text-base leading-relaxed text-ink-cacao/90">{product.description}</p>

          <div className="mb-6 border-t border-ink-cacao/15 pt-5">
            <h2 className="mb-3 font-sans text-[11px] font-medium uppercase tracking-widest text-ink-cacao/70">
              {t("product.tastingNotes")}
            </h2>
            <p className="font-spectral text-sm text-ink-cacao">
              {product.notes.map((note) => t(`notes.${note}`)).join(", ")}: {product.tastingSummary}
            </p>
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-3">
            {!soldOut && (
              <QuantityStepper
                value={quantity}
                onChange={setQuantity}
                max={maxQuantity}
                decreaseLabel={t("product.decrease")}
                increaseLabel={t("product.increase")}
              />
            )}
            <button
              type="button"
              onClick={() => addProduct(product.id, quantity)}
              disabled={soldOut}
              className="min-h-11 flex-1 bg-sun-gold px-6 py-2.5 font-sans text-sm font-medium text-ink-cacao hover:bg-sun-gold/90 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-sun-gold"
            >
              {soldOut ? t("stock.out") : t("catalog.addToCart")}
            </button>
          </div>

          <BatchPassport product={product} />

          <p className="mt-4 flex items-center gap-2 font-sans text-xs text-canopy-green">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-canopy-green" />
            {t("product.organic")}
          </p>
        </div>
      </div>

      <section aria-labelledby="origin-story" className="on-dark mt-4 bg-ink-cacao text-paper-text">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-[2fr_3fr] md:gap-16 md:py-20">
          <figure>
            <OriginMap />
            <figcaption className="mt-4 text-center font-sans text-xs text-paper-text/70">
              {t("product.growingRegion", { origin: originName(product.origin, lang) })}
            </figcaption>
          </figure>
          <div>
            <p className="mb-4 font-sans text-[11px] uppercase tracking-[0.2em] text-sun-gold">{t("product.originStoryLabel")}</p>
            <h2 id="origin-story" className="mb-5 font-spectral text-3xl font-semibold leading-snug">
              {product.farm}
            </h2>
            <p className="mb-6 font-spectral text-base leading-relaxed text-paper-text/90">
              {product.description} {t("product.originStory1")}
            </p>
            <p className="font-spectral text-base leading-relaxed text-paper-text/90">{t("product.originStory2")}</p>
          </div>
        </div>
      </section>
    </div>
  );
}