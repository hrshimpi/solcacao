// The status of a request as a small label. The word is always there, the colour only helps.
import { useLang } from "../../../i18n/LanguageContext";
import { statusText } from "../requestLabels";
import { isKnownStatus, type KnownStatus } from "../requestTypes";

const styles: Record<KnownStatus, string> = {
  submitted: "border-ink-cacao text-ink-cacao",
  quoted: "border-sun-gold bg-sun-gold text-ink-cacao",
  approved: "border-canopy-green bg-canopy-green text-stone-paper",
  rejected: "border-pod-wine bg-pod-wine text-paper-text",
};

export default function StatusBadge({ status }: { status: string }) {
  const { t } = useLang();

  return (
    <span
      className={`inline-block shrink-0 border px-2 py-0.5 font-sans text-[11px] font-medium uppercase tracking-wider ${
        isKnownStatus(status) ? styles[status] : "border-ink-cacao text-ink-cacao"
      }`}
    >
      {statusText(status, t)}
    </span>
  );
}
