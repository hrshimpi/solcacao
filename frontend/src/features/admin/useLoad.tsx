// What every page of the dashboard does first: ask the server, and say what is going on meanwhile (loading, or could not be
// loaded with a way to try again). The page gets the answer when there is one, and can put a newer answer in its place.
import { useEffect, useState, type ReactNode } from "react";
import { useLang } from "../../i18n/LanguageContext";

export type Load<T> = { status: "loading" } | { status: "failed" } | { status: "ready"; data: T };

export function useLoad<T>(run: (signal: AbortSignal) => Promise<T>, deps: unknown[]) {
  const [load, setLoad] = useState<Load<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    // a list that is read again keeps what it shows until the new answer is there
    setLoad((current) => (current.status === "ready" ? current : { status: "loading" }));
    run(controller.signal)
      .then((data) => setLoad({ status: "ready", data }))
      .catch(() => {
        if (!controller.signal.aborted) setLoad({ status: "failed" });
      });
    return () => controller.abort();
    // the caller names what the request depends on
  }, [...deps, attempt]);

  return { load, reload: () => setAttempt((count) => count + 1), setData: (data: T) => setLoad({ status: "ready", data }) };
}

export function LoadState<T>({ load, reload, children }: { load: Load<T>; reload: () => void; children: (data: T) => ReactNode }) {
  const { t } = useLang();

  if (load.status === "loading") {
    return (
      <p role="status" className="font-sans text-sm text-ink-cacao/70">
        {t("admin.loading")}
      </p>
    );
  }
  if (load.status === "failed") {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-4 border-l-4 border-pod-wine bg-clay-surface px-4 py-3 font-sans text-sm text-ink-cacao">
        <span>{t("admin.loadError")}</span>
        <button type="button" onClick={reload} className="min-h-11 underline underline-offset-4 hover:text-pod-wine">
          {t("common.retry")}
        </button>
      </div>
    );
  }
  return <>{children(load.data)}</>;
}
