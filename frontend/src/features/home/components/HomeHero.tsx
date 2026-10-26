// The first screen of the home page: headline, two buttons and a strip of featured origins.
import { getProducts } from "../../../data/products";
import { useLang } from "../../../i18n/LanguageContext";
import LocaleLink from "../../../ui/LocaleLink";

const stripSlugs = ["ecuador-72", "peru-68", "venezuela-76", "madagascar-80"];

// The hero photo comes in three sizes, so a phone downloads about 85 KB instead of 250 KB.
// Each size has the same 16:9 shape as the 1600 by 900 one.
const heroPhoto = "https://images.unsplash.com/photo-1743252878695-367d69dc87a8";
const heroWidths = [800, 1200, 1600];
const heroUrl = (width: number) => `${heroPhoto}?w=${width}&h=${Math.round((width * 9) / 16)}&fit=crop&auto=format&q=70`;
const heroSrcSet = heroWidths.map((width) => `${heroUrl(width)} ${width}w`).join(", ");

export default function HomeHero() {
  const { t, lang } = useLang();
  const strip = getProducts(lang).filter((product) => stripSlugs.includes(product.slug));

  return (
    <section className="on-dark relative flex min-h-[calc(100dvh-3.5rem)] items-end overflow-hidden bg-ink-cacao pb-28 pt-16">
      <img
        src={heroUrl(1600)}
        srcSet={heroSrcSet}
        sizes="100vw"
        alt=""
        width={1600}
        height={900}
        loading="eager"
        fetchPriority="high"
        className="absolute inset-0 h-full w-full object-cover object-[center_30%]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-ink-cacao/80 lg:bg-transparent lg:bg-gradient-to-r lg:from-ink-cacao/90 lg:via-ink-cacao/75 lg:to-ink-cacao/30"
      />

      <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="max-w-xl">
          <p className="reveal-up mb-6 font-sans text-[11px] uppercase tracking-[0.2em] text-sun-gold">{t("home.eyebrow")}</p>
          <h1 className="reveal-up mb-10 font-spectral text-[clamp(2.5rem,9vw,4.5rem)] font-semibold leading-[1.05] text-paper-text">
            {t("home.heroLine1")}
            <br />
            {t("home.heroLine2")}
            <br />
            {t("home.heroLine3")}
          </h1>
          <div className="reveal-up-delay flex flex-wrap gap-4">
            <LocaleLink
              to="/shop"
              className="inline-flex min-h-11 items-center bg-sun-gold px-8 py-3 font-sans text-sm font-medium text-ink-cacao hover:bg-sun-gold/90"
            >
              {t("home.shopCollection")}
            </LocaleLink>
            <LocaleLink
              to="/wholesale"
              className="inline-flex min-h-11 items-center border border-paper-text/60 px-8 py-3 font-sans text-sm font-medium text-paper-text hover:border-paper-text"
            >
              {t("home.exploreWholesale")}
            </LocaleLink>
          </div>
        </div>
      </div>

      <ul className="absolute inset-x-0 bottom-0 mx-auto flex max-w-7xl flex-wrap gap-x-8 gap-y-1 border-t border-paper-text/20 px-4 py-4 sm:px-6">
        {strip.map((product) => (
          <li key={product.id} className="font-sans text-xs text-paper-text/80">
            {product.name}
          </li>
        ))}
      </ul>
    </section>
  );
}
