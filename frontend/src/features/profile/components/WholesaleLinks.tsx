// The wholesale part of the account page: a link to the quote requests. Only business accounts have quote requests,
// so everybody else sees nothing here.
import { useLang } from "../../../i18n/LanguageContext";
import { ArrowRightIcon } from "../../../ui/Icons";
import LocaleLink from "../../../ui/LocaleLink";
import { useAuth } from "../../auth/AuthContext";

export default function WholesaleLinks() {
  const { t } = useLang();
  const { user } = useAuth();
  if (user?.accountType !== "business") return null;

  return (
    <section aria-labelledby="profile-wholesale" className="mt-14 md:mt-16">
      <div className="border-b border-ink-cacao pb-4">
        <h2 id="profile-wholesale" className="font-spectral text-2xl font-semibold text-ink-cacao">
          {t("b2b.requests.account.section")}
        </h2>
      </div>
      <LocaleLink
        to="/account/requests"
        className="group flex min-h-14 w-full items-center justify-between border-b border-ink-cacao/20 py-4 text-left"
      >
        <span>
          <span className="block font-sans text-sm font-medium text-ink-cacao">{t("b2b.requests.account.link")}</span>
          <span className="mt-1 block font-sans text-xs text-ink-cacao/70">{t("b2b.requests.account.hint")}</span>
        </span>
        <ArrowRightIcon className="text-ink-cacao/70 group-hover:translate-x-1 group-hover:text-pod-wine" />
      </LocaleLink>
    </section>
  );
}
