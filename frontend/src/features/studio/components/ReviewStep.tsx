// The last wizard step: a summary of the choices and the contact details form.
import { useLang } from "../../../i18n/LanguageContext";
import TextField from "../../../ui/TextField";

export type StudioFields = "company" | "contact" | "quantity" | "notes";

interface FieldProps {
  name: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}

interface ReviewStepProps {
  summary: { profile: string; packaging: string; fileCount: number };
  field: (name: StudioFields) => FieldProps;
}

export default function ReviewStep({ summary, field }: ReviewStepProps) {
  const { t } = useLang();

  const rows = [
    { label: t("studio.summaryProfile"), value: summary.profile },
    { label: t("studio.summaryPackaging"), value: summary.packaging },
    { label: t("studio.summaryAssets"), value: summary.fileCount > 0 ? t("studio.fileCount", { count: summary.fileCount }) : t("studio.noFiles") },
  ];

  return (
    <div className="border border-ink-cacao bg-clay-surface p-5 sm:p-8">
      <h3 className="mb-5 font-sans text-[11px] uppercase tracking-[0.2em] text-ink-cacao/70">{t("studio.orderSummary")}</h3>
      <dl className="mb-6 space-y-4">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 border-b border-ink-cacao/15 pb-3">
            <dt className="font-sans text-[11px] uppercase tracking-widest text-ink-cacao/70">{row.label}</dt>
            <dd className="text-right font-spectral text-sm text-ink-cacao">{row.value}</dd>
          </div>
        ))}
      </dl>

      <p className="mb-4 font-sans text-xs text-ink-cacao/70">{t("common.requiredNote")}</p>
      <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
        <TextField label={t("studio.company")} autoComplete="organization" required {...field("company")} />
        <TextField label={t("studio.contact")} autoComplete="name" required {...field("contact")} />
        <TextField
          label={t("studio.units")}
          inputMode="numeric"
          required
          hint={t("studio.unitsHint")}
          {...field("quantity")}
        />
        <div className="md:col-span-2">
          <TextField label={t("studio.notes")} multiline rows={3} placeholder={t("studio.notesPlaceholder")} {...field("notes")} />
        </div>
      </div>
    </div>
  );
}
