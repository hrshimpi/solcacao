// Decides who gets into the Corporate Cacao Studio:
//   nobody signed in    -> the sign in page, which brings them back here afterwards
//   a retail account    -> a short message with a link to create a business account
//   a business account  -> the studio
// This only keeps the wrong people from a page they could not use. The server checks the account type again.
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useLang } from "../../../i18n/LanguageContext";
import { usePageTitle } from "../../../lib/usePageTitle";
import LocaleLink from "../../../ui/LocaleLink";
import { useAuth } from "../../auth/AuthContext";
import { loginWithNext, withoutLanguage } from "../../auth/nextPath";

function RetailNotice() {
  const { t } = useLang();
  usePageTitle(t("titles.studio"));

  return (
    <div className="min-h-[60dvh] bg-stone-paper">
      <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
        <p className="mb-4 font-sans text-[11px] uppercase tracking-[0.2em] text-pod-wine">{t("wholesale.eyebrow")}</p>
        <h1 className="mb-4 font-spectral text-4xl font-semibold text-ink-cacao">{t("wholesale.accessTitle")}</h1>
        <p className="mb-8 max-w-xl font-spectral text-ink-cacao/70">{t("wholesale.accessBody")}</p>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
          <LocaleLink
            to="/account/register?type=business"
            className="inline-flex min-h-11 items-center bg-ink-cacao px-8 py-3 font-sans text-sm font-medium text-stone-paper hover:bg-pod-wine"
          >
            {t("wholesale.accessCreate")}
          </LocaleLink>
          <LocaleLink to="/wholesale" className="inline-flex min-h-11 items-center font-sans text-sm underline underline-offset-4 hover:text-pod-wine">
            {t("wholesale.accessBack")}
          </LocaleLink>
        </div>
      </div>
    </div>
  );
}

export default function StudioAccessGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { path } = useLang();
  const { pathname, search } = useLocation();

  if (!user) {
    // replace, so the Back button does not return to a page that sends you away again
    return <Navigate to={path(loginWithNext(withoutLanguage(pathname) + search))} replace />;
  }
  if (user.accountType !== "business") return <RetailNotice />;
  return children;
}
