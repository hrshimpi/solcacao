// The frame shared by the sign in and create account pages: a photo panel (from md), the account type choice and the page heading.
import type { ReactNode } from "react";
import { useLang } from "../../../i18n/LanguageContext";
import RadioRow from "../../../ui/RadioRow";

export type AccountType = "retail" | "business";

interface AuthShellProps {
  title: string;
  accountType: AccountType;
  onAccountTypeChange: (type: AccountType) => void;
  children: ReactNode;
}

const panelImage = "https://images.unsplash.com/photo-1722699350336-b22f6a263499?w=800&h=1000&fit=crop&auto=format";

export default function AuthShell({ title, accountType, onAccountTypeChange, children }: AuthShellProps) {
  const { t } = useLang();

  return (
    <div className="grid md:min-h-[calc(100dvh-3.5rem)] md:grid-cols-2">
      <div
        aria-hidden="true"
        className="relative hidden flex-col justify-end bg-ink-cacao bg-cover bg-center p-14 md:flex"
        style={{ backgroundImage: `url(${panelImage})` }}
      >
        <div className="absolute inset-0 bg-ink-cacao/85" />
        <div className="relative">
          <p className="max-w-xs font-spectral text-3xl font-semibold leading-snug text-paper-text">{t("auth.panelTitle")}</p>
          <p className="mt-4 max-w-xs font-spectral leading-relaxed text-paper-text/80">{t("auth.panelBody")}</p>
          <div className="mt-8 flex items-center gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-sun-gold" />
            <p className="font-sans text-xs text-paper-text/80">{t("auth.panelList")}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-center bg-stone-paper px-4 py-12 sm:px-8 md:px-14 md:py-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 border-b border-ink-cacao/20 pb-3">
            <RadioRow
              legend={t("auth.accountType")}
              name="accountType"
              value={accountType}
              onChange={onAccountTypeChange}
              hideLegend
              options={[
                { id: "retail", label: t("auth.retail") },
                { id: "business", label: t("auth.business") },
              ]}
            />
          </div>

          <h1 className="mb-8 font-spectral text-3xl font-semibold text-ink-cacao">{title}</h1>

          {children}

          {accountType === "business" && (
            <div className="mt-8 border border-ink-cacao/20 bg-clay-surface p-4">
              <p className="font-sans text-xs leading-relaxed text-ink-cacao/70">{t("auth.businessNote")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
