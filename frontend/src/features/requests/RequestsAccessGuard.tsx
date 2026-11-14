// Who may open My quote requests: a business account. Nobody signed in goes to the sign in page and comes back
// afterwards, and a retail account gets a short message with a link to create a business account.
import type { ReactNode } from "react";
import { useLang } from "../../i18n/LanguageContext";
import AccessNotice from "../auth/components/AccessNotice";
import RequireAccountType from "../auth/components/RequireAccountType";

export default function RequestsAccessGuard({ children }: { children: ReactNode }) {
  const { t } = useLang();

  return (
    <RequireAccountType
      accountType="business"
      denied={
        <AccessNotice
          pageTitle={t("titles.requests")}
          eyebrow={t("b2b.requests.eyebrow")}
          title={t("b2b.requests.access.title")}
          body={t("b2b.requests.access.body")}
          createLabel={t("wholesale.accessCreate")}
          backTo="/wholesale"
          backLabel={t("studio.backToWholesale")}
        />
      }
    >
      {children}
    </RequireAccountType>
  );
}
