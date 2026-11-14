// The top of the wholesale page: headline, short intro and the button into the studio.
import { useLang } from "../../../i18n/LanguageContext";
import LocaleLink from "../../../ui/LocaleLink";

export default function WholesaleHero() {
  const { t } = useLang();

  return (
    <section className="on-dark relative overflow-hidden bg-ink-cacao py-20 text-paper-text sm:py-28">
      <img
        src="https://images.unsplash.com/photo-1545567725-ab9b17093edc?w=1200&h=700&fit=crop&auto=format"
        alt=""
        width={1200}
        height={700}
        fetchPriority="high"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-ink-cacao/85" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-xl">
          <p className="mb-6 font-sans text-[11px] uppercase tracking-[0.2em] text-sun-gold">{t("wholesale.eyebrow")}</p>
          <h1 className="mb-6 font-spectral text-[clamp(2.25rem,8vw,3.75rem)] font-semibold leading-[1.05]">
            {t("wholesale.title")}
          </h1>
          <p className="mb-10 max-w-md font-spectral text-lg leading-relaxed text-paper-text/90">{t("wholesale.intro")}</p>
          <LocaleLink
            to="/wholesale/studio"
            className="inline-flex min-h-11 items-center bg-sun-gold px-8 py-3 font-sans text-sm font-medium text-ink-cacao hover:bg-sun-gold/90"
          >
            {t("wholesale.enterStudio")}
          </LocaleLink>
        </div>
      </div>
    </section>
  );
}
