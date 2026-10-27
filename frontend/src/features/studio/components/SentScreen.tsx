// What the person sees once the request was saved: the reference of the request, and where to go next.
import type { RefObject } from "react";
import { useLang } from "../../../i18n/LanguageContext";
import LocaleLink from "../../../ui/LocaleLink";

interface SentScreenProps {
  headingRef: RefObject<HTMLHeadingElement | null>;
  company: string;
  profile: string;
  units: string;
  // empty when the server did not say which request it saved
  reference: string;
}

export default function SentScreen({ headingRef, company, profile, units, reference }: SentScreenProps) {
  const { t } = useLang();

  return (
    <div className="mx-auto max-w-md border border-ink-cacao bg-clay-surface p-8 text-center sm:p-12">
      <p className="mb-4 font-sans text-[11px] uppercase tracking-[0.2em] text-ink-cacao/70">{t("studio.sentEyebrow")}</p>
      <h2 ref={headingRef} tabIndex={-1} className="mb-4 font-spectral text-3xl font-semibold text-ink-cacao">
        {t("studio.sentTitle")}
      </h2>
      <p className="mb-6 font-spectral leading-relaxed text-ink-cacao/80">
        {t("studio.sentBody", { company, profile, quantity: units })}
      </p>
      {reference && (
        <dl className="mb-8 border-y border-ink-cacao/15 py-4">
          <dt className="font-sans text-[11px] uppercase tracking-widest text-ink-cacao/70">{t("b2b.submit.referenceLabel")}</dt>
          <dd className="mt-1 font-mono text-lg font-medium text-ink-cacao">{reference}</dd>
        </dl>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <LocaleLink
          to="/account/requests"
          className="inline-flex min-h-11 items-center justify-center bg-ink-cacao px-6 py-2.5 font-sans text-sm font-medium text-stone-paper hover:bg-pod-wine"
        >
          {t("b2b.submit.myRequests")}
        </LocaleLink>
        <LocaleLink
          to="/wholesale"
          className="inline-flex min-h-11 items-center justify-center border border-ink-cacao px-6 py-2.5 font-sans text-sm font-medium text-ink-cacao hover:bg-ink-cacao hover:text-stone-paper"
        >
          {t("studio.backToWholesale")}
        </LocaleLink>
      </div>
    </div>
  );
}
