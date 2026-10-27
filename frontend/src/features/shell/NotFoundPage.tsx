// The 404 page shown for any address that does not exist.
import { useLang } from "../../i18n/LanguageContext";
import { usePageTitle } from "../../lib/usePageTitle";
import LocaleLink from "../../ui/LocaleLink";

export default function NotFoundPage() {
  const { t } = useLang();
  usePageTitle(t("titles.notFound"));

  return (
    <div className="min-h-[60dvh] bg-stone-paper">
      <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
        <p className="mb-4 font-mono text-xs text-ink-cacao/70">404</p>
        <h1 className="mb-4 font-spectral text-4xl font-semibold text-ink-cacao">{t("common.notFoundTitle")}</h1>
        <p className="mb-8 font-spectral text-ink-cacao/70">{t("common.notFoundBody")}</p>
        <div className="flex flex-wrap gap-x-6 font-sans text-sm">
          <LocaleLink to="/" className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-pod-wine">
            {t("common.notFoundHome")}
          </LocaleLink>
          <LocaleLink to="/shop" className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-pod-wine">
            {t("common.notFoundShop")}
          </LocaleLink>
        </div>
      </div>
    </div>
  );
}
