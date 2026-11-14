// An information page (FAQ, shipping, returns and so on). The text comes from the info group in the language files.
import { useParams } from "react-router";
import { useLang } from "../../i18n/LanguageContext";
import { usePageTitle } from "../../lib/usePageTitle";
import NotFoundPage from "../shell/NotFoundPage";

const slugs = ["faq", "shipping", "returns", "privacy", "terms", "story", "sustainability", "press", "careers", "partners"] as const;
type InfoSlug = (typeof slugs)[number];

const isInfoSlug = (value: string | undefined): value is InfoSlug => slugs.some((s) => s === value);

export default function InfoPage() {
  const { t } = useLang();
  const { topic } = useParams();
  usePageTitle(isInfoSlug(topic) ? t(`info.${topic}.title`) : t("titles.notFound"));

  if (!isInfoSlug(topic)) return <NotFoundPage />;

  return (
    <div className="bg-stone-paper">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="mb-2 font-spectral text-3xl font-semibold text-ink-cacao">{t(`info.${topic}.title`)}</h1>
        <p className="mb-10 font-spectral text-ink-cacao/70">{t(`info.${topic}.intro`)}</p>
        <div className="space-y-4 font-spectral text-ink-cacao/80">
          <p>{t(`info.${topic}.p1`)}</p>
          <p>{t(`info.${topic}.p2`)}</p>
          <p>{t(`info.${topic}.p3`)}</p>
        </div>
      </div>
    </div>
  );
}
