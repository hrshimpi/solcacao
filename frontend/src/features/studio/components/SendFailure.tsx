// Tells the person that the request could not be sent, and why. Focus moves here, so a keyboard or screen reader user
// does not have to look for it. The answers they gave are still in the form.
import type { RefObject } from "react";
import { useLang } from "../../../i18n/LanguageContext";

interface SendFailureProps {
  detail: string;
  alertRef: RefObject<HTMLDivElement | null>;
}

export default function SendFailure({ detail, alertRef }: SendFailureProps) {
  const { t } = useLang();

  return (
    <div ref={alertRef} role="alert" tabIndex={-1} className="mt-8 border-l-4 border-pod-wine bg-clay-surface p-4">
      <p className="font-sans text-sm font-medium text-pod-wine">{t("b2b.submit.failedTitle")}</p>
      <p className="mt-1 font-sans text-sm text-ink-cacao">{detail}</p>
      <p className="mt-1 font-sans text-xs text-ink-cacao/70">{t("b2b.submit.keptNote")}</p>
    </div>
  );
}
