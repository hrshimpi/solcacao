// Decides who gets into the Corporate Cacao Studio: a business account. Nobody signed in goes to the sign in page and
// comes back afterwards, and a retail account gets a short message with a link to create a business account.
// This only keeps the wrong people from a page they could not use. The server checks the account type again.
import type { ReactNode } from "react";
import { useLang } from "../../../i18n/LanguageContext";
import AccessNotice from "../../auth/components/AccessNotice";
import RequireAccountType from "../../auth/components/RequireAccountType";

export default function StudioAccessGuard({ children }: { children: ReactNode }) {
  const { t } = useLang();

  return (
    <RequireAccountType
      accountType="business"
      denied={
        <AccessNotice
          pageTitle={t("titles.studio")}
          eyebrow={t("wholesale.eyebrow")}
          title={t("wholesale.accessTitle")}
          body={t("wholesale.accessBody")}
          createLabel={t("wholesale.accessCreate")}
          backTo="/wholesale"
          backLabel={t("wholesale.accessBack")}
        />
      }
    >
      {children}
    </RequireAccountType>
  );
}
