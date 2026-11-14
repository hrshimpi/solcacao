// Shows how much of the files has gone up while a request is being sent.
import { useLang } from "../../../i18n/LanguageContext";

export default function SendProgress({ progress }: { progress: number | null }) {
  const { t } = useLang();
  if (progress === null) return null;

  const percent = Math.round(progress * 100);

  return (
    <div className="mt-8">
      <label htmlFor="send-progress" className="mb-2 block font-sans text-sm text-ink-cacao">
        {progress >= 1 ? t("b2b.submit.waiting") : t("b2b.submit.progress", { percent })}
      </label>
      <progress id="send-progress" value={progress} max={1} className="block h-2 w-full accent-pod-wine" />
    </div>
  );
}
