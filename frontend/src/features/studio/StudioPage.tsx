// The Corporate Cacao Studio: a four step wizard (cacao profile, packaging, brand files, review).
// What you typed is kept when you go back, each step is checked before Continue, and sending is simulated.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLang } from "../../i18n/LanguageContext";
import { useForm } from "../../lib/useForm";
import { usePageTitle } from "../../lib/usePageTitle";
import { maxLength, minNumber, required, wholeNumber } from "../../lib/validation";
import { useAnnounce } from "../../ui/LiveRegion";
import LocaleLink from "../../ui/LocaleLink";
import ChoiceCards from "./components/ChoiceCards";
import FileDrop from "./components/FileDrop";
import ReviewStep, { type StudioFields } from "./components/ReviewStep";
import WizardSteps from "./components/WizardSteps";
import ProfileStep from "./steps/ProfileStep";
import { MIN_UNITS, packagingIds, type PackagingId, type ProfileId, type StudioFile } from "./studioOptions";

const stepKeys = ["profile", "packaging", "assets", "review"] as const;

export default function StudioPage() {
  const { t } = useLang();
  const announce = useAnnounce();
  usePageTitle(t("titles.studio"));

  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<ProfileId | null>(null);
  const [packaging, setPackaging] = useState<PackagingId | null>(null);
  const [files, setFiles] = useState<StudioFile[]>([]);
  const [stepError, setStepError] = useState("");
  const [status, setStatus] = useState<"editing" | "sending" | "sent">("editing");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const form = useForm<StudioFields>({
    initial: { company: "", contact: "", quantity: "", notes: "" },
    rules: {
      company: [required, maxLength(80)],
      contact: [required, maxLength(80)],
      quantity: [required, wholeNumber, minNumber(MIN_UNITS)],
      notes: [maxLength(500)],
    },
    onSubmit: () => setStatus("sending"),
  });

  useEffect(() => {
    if (status !== "sending") return;
    const timer = window.setTimeout(() => {
      setStatus("sent");
      announce(t("studio.sentAnnounce"));
    }, 800);
    return () => window.clearTimeout(timer);
  }, [status, announce, t]);

  // move focus to the step heading when the step (or the confirmation) changes
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step, status]);

  function focusFirstChoice() {
    requestAnimationFrame(() => document.querySelector<HTMLElement>("[role=radiogroup] input")?.focus());
  }

  function goNext(event: FormEvent) {
    event.preventDefault();
    if (step === 0 && !profile) {
      setStepError(t("studio.errorProfile"));
      focusFirstChoice();
      return;
    }
    if (step === 1 && !packaging) {
      setStepError(t("studio.errorPackaging"));
      focusFirstChoice();
      return;
    }
    setStepError("");
    setStep((current) => current + 1);
  }

  const names = stepKeys.map((key) => t(`studio.steps.${key}`));
  const shortNames = stepKeys.map((key) => t(`studio.shortSteps.${key}`));
  const profileLabel = profile ? t(`studio.profiles.${profile}.label`) : t("studio.notChosen");
  const packagingLabel = packaging ? t(`studio.packaging.${packaging}.label`) : t("studio.notChosen");

  return (
    <div className="bg-stone-paper">
      <div className="border-b border-ink-cacao">
        <div className="mx-auto max-w-4xl px-4 pt-10 sm:px-6">
          <p className="mb-2 font-sans text-[11px] uppercase tracking-[0.2em] text-ink-cacao/70">{t("studio.eyebrow")}</p>
          <h1 className="font-spectral text-3xl font-semibold text-ink-cacao">{t("studio.title")}</h1>
          {status === "editing" && (
            <WizardSteps names={names} shortNames={shortNames} current={step} onGoTo={setStep} />
          )}
          {status !== "editing" && <div className="h-8" />}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
        {status === "sent" ? (
          <div className="mx-auto max-w-md border border-ink-cacao bg-clay-surface p-8 text-center sm:p-12">
            <p className="mb-4 font-sans text-[11px] uppercase tracking-[0.2em] text-ink-cacao/70">{t("studio.sentEyebrow")}</p>
            <h2 ref={headingRef} tabIndex={-1} className="mb-4 font-spectral text-3xl font-semibold text-ink-cacao">
              {t("studio.sentTitle")}
            </h2>
            <p className="mb-4 font-spectral leading-relaxed text-ink-cacao/80">
              {t("studio.sentBody", { company: form.values.company, profile: profileLabel, quantity: form.values.quantity })}
            </p>
            <p className="mb-8 font-sans text-xs text-ink-cacao/70">{t("studio.sentPreview")}</p>
            <LocaleLink
              to="/wholesale"
              className="inline-flex min-h-11 items-center border border-ink-cacao px-6 py-2.5 font-sans text-sm font-medium text-ink-cacao hover:bg-ink-cacao hover:text-stone-paper"
            >
              {t("studio.backToWholesale")}
            </LocaleLink>
          </div>
        ) : (
          <form ref={form.formRef} onSubmit={step === 3 ? form.handleSubmit : goNext} noValidate>
            <h2 id="step-heading" ref={headingRef} tabIndex={-1} className="mb-2 font-spectral text-xl text-ink-cacao">
              {t(`studio.headings.${stepKeys[step]}`)}
            </h2>
            <p className="mb-8 font-sans text-xs text-ink-cacao/70">{t(`studio.hints.${stepKeys[step]}`)}</p>

            {step === 0 && (
              <ProfileStep
                headingId="step-heading"
                value={profile}
                onChange={(id) => {
                  setProfile(id);
                  setStepError("");
                }}
                error={stepError}
              />
            )}

            {step === 1 && (
              <ChoiceCards
                name="packaging"
                labelledBy="step-heading"
                value={packaging}
                onChange={(id) => {
                  setPackaging(id);
                  setStepError("");
                }}
                error={stepError}
                className="grid-cols-1 md:grid-cols-2"
                choices={packagingIds.map((id) => ({
                  id,
                  label: t(`studio.packaging.${id}.label`),
                  sub: t(`studio.packaging.${id}.sub`),
                }))}
              />
            )}

            {step === 2 && <FileDrop files={files} onChange={setFiles} />}

            {step === 3 && (
              <ReviewStep summary={{ profile: profileLabel, packaging: packagingLabel, fileCount: files.length }} field={form.field} />
            )}

            <div className="mt-12 flex flex-col-reverse gap-3 border-t border-ink-cacao/15 pt-8 sm:flex-row sm:items-center sm:justify-between">
              {step === 0 ? (
                <LocaleLink
                  to="/wholesale"
                  className="inline-flex min-h-11 w-full items-center justify-center font-sans text-sm text-ink-cacao underline underline-offset-4 sm:w-auto"
                >
                  {t("studio.backToWholesale")}
                </LocaleLink>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep((current) => current - 1)}
                  className="min-h-11 w-full font-sans text-sm text-ink-cacao underline underline-offset-4 sm:w-auto"
                >
                  {t("studio.previous")}
                </button>
              )}
              <button
                type="submit"
                disabled={status === "sending"}
                className="min-h-11 w-full bg-ink-cacao px-8 py-3 font-sans text-sm font-medium text-stone-paper hover:bg-pod-wine disabled:opacity-70 sm:w-auto"
              >
                {step < 3 ? t("studio.continue") : status === "sending" ? t("studio.sending") : t("studio.submit")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
