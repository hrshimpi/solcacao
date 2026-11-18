// The way to the dashboard, on the account page of an admin (nobody else sees it).
import { useLang } from "../../../i18n/LanguageContext";
import { ArrowRightIcon } from "../../../ui/Icons";
import LocaleLink from "../../../ui/LocaleLink";

export default function AdminLink() {
  const { t } = useLang();

  return (
    <section aria-labelledby="profile-admin" className="mt-14 md:mt-16">
      <div className="border-b border-ink-cacao pb-4">
        <h2 id="profile-admin" className="font-spectral text-2xl font-semibold text-ink-cacao">
          {t("profile.admin.title")}
        </h2>
      </div>
      <LocaleLink to="/admin" className="group flex min-h-14 w-full items-center justify-between border-b border-ink-cacao/20 py-4 text-left">
        <span>
          <span className="block font-sans text-sm font-medium text-ink-cacao">{t("profile.admin.link")}</span>
          <span className="mt-1 block font-sans text-xs text-ink-cacao/70">{t("profile.admin.body")}</span>
        </span>
        <ArrowRightIcon className="text-ink-cacao/70 group-hover:translate-x-1 group-hover:text-pod-wine" />
      </LocaleLink>
    </section>
  );
}
