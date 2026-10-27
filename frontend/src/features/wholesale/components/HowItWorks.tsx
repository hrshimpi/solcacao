// The four ordering steps and the closing call to action on the wholesale page.
import { useLang } from "../../../i18n/LanguageContext";
import { ArrowRightIcon } from "../../../ui/Icons";
import LocaleLink from "../../../ui/LocaleLink";

const steps = [
  { title: "wholesale.step1Title", desc: "wholesale.step1Desc" },
  { title: "wholesale.step2Title", desc: "wholesale.step2Desc" },
  { title: "wholesale.step3Title", desc: "wholesale.step3Desc" },
  { title: "wholesale.step4Title", desc: "wholesale.step4Desc" },
] as const;

export default function HowItWorks() {
  const { t } = useLang();

  return (
    <>
      <section aria-labelledby="how-title" className="border-t border-ink-cacao bg-stone-paper py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid items-start gap-12 md:grid-cols-[2fr_3fr] md:gap-16">
            <div>
              <p className="mb-4 font-sans text-[11px] uppercase tracking-[0.2em] text-ink-cacao/70">{t("wholesale.howEyebrow")}</p>
              <h2 id="how-title" className="mb-5 font-spectral text-3xl font-semibold leading-snug text-ink-cacao">
                {t("wholesale.howTitle")}
              </h2>
              <p className="font-spectral leading-relaxed text-ink-cacao/80">{t("wholesale.howBody")}</p>
              <LocaleLink
                to="/wholesale/studio"
                className="mt-8 inline-flex min-h-11 items-center gap-2 bg-ink-cacao px-8 py-3 font-sans text-sm font-medium text-stone-paper hover:bg-pod-wine"
              >
                {t("wholesale.startStudio")}
                <ArrowRightIcon size={16} />
              </LocaleLink>
            </div>

            <ol>
              {steps.map((step, index) => (
                <li key={step.title} className={`flex gap-6 py-6 ${index < steps.length - 1 ? "border-b border-ink-cacao/15" : ""}`}>
                  <span aria-hidden="true" className="mt-0.5 w-8 shrink-0 font-mono text-xs text-ink-cacao/70">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="mb-1 font-spectral text-base font-semibold text-ink-cacao">{t(step.title)}</p>
                    <p className="font-sans text-xs leading-relaxed text-ink-cacao/70">{t(step.desc)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section aria-labelledby="cta-title" className="bg-sun-gold py-14 sm:py-16">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 sm:px-6 md:flex-row md:items-center">
          <div>
            <h2 id="cta-title" className="font-spectral text-3xl font-semibold text-ink-cacao">
              {t("wholesale.ctaTitle")}
            </h2>
            <p className="mt-1 font-sans text-sm text-ink-cacao">{t("wholesale.ctaSub")}</p>
          </div>
          <LocaleLink
            to="/wholesale/studio"
            className="inline-flex min-h-11 shrink-0 items-center bg-ink-cacao px-8 py-3 font-sans text-sm font-medium text-stone-paper hover:bg-pod-wine"
          >
            {t("wholesale.enterStudio")}
          </LocaleLink>
        </div>
      </section>
    </>
  );
}
