// What a page shows while it waits for something it cannot do without (who is signed in, the data of the page). It is a
// status message, so a screen reader says it, and it keeps the page tall enough that the footer does not jump.
import { useLang } from "../i18n/LanguageContext";

export default function PageLoading({ label }: { label?: string }) {
  const { t } = useLang();

  return (
    <div className="flex min-h-[60dvh] items-center justify-center bg-stone-paper px-4">
      <p role="status" className="font-sans text-sm text-ink-cacao/70">
        {label ?? t("common.loading")}
      </p>
    </div>
  );
}
