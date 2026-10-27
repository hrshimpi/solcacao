// A dark banner at the bottom of the home page that points business customers to the wholesale page.
import { useLang } from "../../../i18n/LanguageContext";
import LocaleLink from "../../../ui/LocaleLink";

export default function WholesaleTeaser() {
  const { t } = useLang();

  return (
    <section aria-labelledby="teaser-title" className="on-dark bg-ink-cacao py-16 text-paper-text sm:py-20">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-4 sm:px-6 md:flex-row md:items-center">
        <div>
          <p className="mb-3 font-sans text-[11px] uppercase tracking-[0.2em] text-sun-gold">{t("home.teaserEyebrow")}</p>
          <h2 id="teaser-title" className="max-w-md font-spectral text-3xl font-semibold">
            {t("home.teaserTitle")}
          </h2>
        </div>
        <LocaleLink
          to="/wholesale"
          className="inline-flex min-h-11 shrink-0 items-center bg-sun-gold px-8 py-3 font-sans text-sm font-medium text-ink-cacao hover:bg-sun-gold/90"
        >
          {t("home.exploreWholesale")}
        </LocaleLink>
      </div>
    </section>
  );
}
