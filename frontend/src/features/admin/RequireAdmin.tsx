// Keeps the dashboard from everybody who is not an admin. Somebody who is not signed in is sent to sign in (and comes back),
// and somebody who is signed in but is not an admin is told that the page is for the team. The server checks the token of an
// admin again for every call, so this only decides what the pages show.
import type { ReactNode } from "react";
import { useLang } from "../../i18n/LanguageContext";
import LocaleLink from "../../ui/LocaleLink";
import RequireAuth from "../auth/components/RequireAuth";
import { useAuth } from "../auth/AuthContext";

function AdminOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { t } = useLang();

  if (user?.role === "admin") return <>{children}</>;
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 bg-stone-paper px-4 text-center">
      <h1 className="font-spectral text-3xl font-semibold text-ink-cacao">{t("admin.noAccess.title")}</h1>
      <p className="max-w-md font-spectral text-ink-cacao/70">{t("admin.noAccess.body")}</p>
      <LocaleLink to="/" className="inline-flex min-h-11 items-center font-sans text-sm text-ink-cacao underline underline-offset-4 hover:text-pod-wine">
        {t("admin.noAccess.link")}
      </LocaleLink>
    </div>
  );
}

export default function RequireAdmin({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <AdminOnly>{children}</AdminOnly>
    </RequireAuth>
  );
}
