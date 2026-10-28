// Step 4 of the studio: a summary of the choices, then the company, the contact, the units and the notes.
// Fewer units than the usual minimum run only gets a warning, because the request can still be sent.
import { useEffect, useState, type ReactNode } from "react";
import { useLang } from "../../../i18n/LanguageContext";
import { useAnnounce } from "../../../ui/LiveRegion";
import TextField from "../../../ui/TextField";
import { MIN_UNITS } from "../studioOptions";
import { isSmallRun, type ReviewField } from "../studioRules";

interface FieldProps {
  name: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}

interface ReviewStepProps {
  summary: { profile: string; packaging: string; files: File[] };
  field: (name: ReviewField) => FieldProps;
}

export default function ReviewStep({ summary, field }: ReviewStepProps) {
  const { t } = useLang();
  const announce = useAnnounce();
  const units = field("units");

  // the warning waits until the person has left the field, so it does not flash while 500 is still being typed
  const [unitsLeft, setUnitsLeft] = useState(units.value !== "");
  const warning = unitsLeft && isSmallRun(units.value) ? t("b2b.review.smallRun", { min: MIN_UNITS }) : undefined;

  useEffect(() => {
    if (warning) announce(warning);
  }, [warning, announce]);

  return (
    <div className="border border-ink-cacao bg-clay-surface p-5 sm:p-8">
      <h3 className="mb-5 font-sans text-[11px] uppercase tracking-[0.2em] text-ink-cacao/70">{t("studio.orderSummary")}</h3>
      <dl className="mb-6 space-y-4">
        <SummaryRow label={t("studio.summaryProfile")}>{summary.profile}</SummaryRow>
        <SummaryRow label={t("studio.summaryPackaging")}>{summary.packaging}</SummaryRow>
        <SummaryRow label={t("studio.summaryAssets")}>
          {summary.files.length > 0 ? (
            <>
              {t("studio.fileCount", { count: summary.files.length })}
              <ul className="mt-1 font-sans text-xs text-ink-cacao/70">
                {summary.files.map((file) => (
                  <li key={`${file.name}-${file.size}-${file.lastModified}`} className="break-all">
                    {file.name}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            t("studio.noFiles")
          )}
        </SummaryRow>
      </dl>

      <p className="mb-4 font-sans text-xs text-ink-cacao/70">{t("common.requiredNote")}</p>
      <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
        <TextField label={t("studio.company")} autoComplete="organization" required {...field("companyName")} />
        <TextField label={t("studio.contact")} autoComplete="name" required {...field("contactName")} />
        <TextField
          label={t("studio.units")}
          inputMode="numeric"
          required
          hint={t("studio.unitsHint", { min: MIN_UNITS })}
          warning={warning}
          {...units}
          onBlur={() => {
            setUnitsLeft(true);
            units.onBlur();
          }}
        />
        <div className="md:col-span-2">
          <TextField label={t("studio.notes")} multiline rows={3} placeholder={t("studio.notesPlaceholder")} {...field("notes")} />
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-ink-cacao/15 pb-3">
      <dt className="font-sans text-[11px] uppercase tracking-widest text-ink-cacao/70">{label}</dt>
      <dd className="text-right font-spectral text-sm text-ink-cacao">{children}</dd>
    </div>
  );
}
