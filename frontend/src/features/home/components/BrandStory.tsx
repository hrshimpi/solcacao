// The brand story section. The "Our Origins" link in the menu jumps here (id="origins").
import { useLang } from "../../../i18n/LanguageContext";
import { ArrowRightIcon } from "../../../ui/Icons";
import LocaleLink from "../../../ui/LocaleLink";

export default function BrandStory() {
  const { t } = useLang();

  return (
    <section id="origins" tabIndex={-1} aria-labelledby="story-title" className="on-dark bg-pod-wine py-20 text-paper-text sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-12 md:grid-cols-[3fr_2fr] md:gap-16">
          <div>
            <p className="mb-5 font-sans text-[11px] uppercase tracking-[0.2em] text-sun-gold">{t("home.philosophy")}</p>
            <h2 id="story-title" className="mb-6 font-spectral text-4xl font-semibold leading-snug md:text-5xl">
              {t("home.storyTitle")}
            </h2>
            <p className="mb-8 max-w-xl font-spectral text-lg leading-relaxed text-paper-text/90">{t("home.storyBody")}</p>
            <LocaleLink
              to="/shop/ecuador-72"
              className="inline-flex min-h-11 items-center gap-2 border-b border-paper-text/70 pb-0.5 font-sans text-sm hover:border-paper-text"
            >
              {t("home.seePassport")}
              <ArrowRightIcon size={16} />
            </LocaleLink>
          </div>
          <img
            src="https://images.unsplash.com/photo-1507576164121-220762647800?w=700&h=875&fit=crop&auto=format"
            alt=""
            width={700}
            height={875}
            loading="lazy"
            className="aspect-[4/5] w-full object-cover"
          />
        </div>
      </div>
    </section>
  );
}
